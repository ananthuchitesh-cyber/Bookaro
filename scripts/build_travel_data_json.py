#!/usr/bin/env python3
import argparse
import io
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from urllib.parse import quote_plus

NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def clean_name(value: str) -> str:
    text = clean_text(re.sub(r"[^A-Za-z0-9 .,&()/-]", " ", str(value or "")))
    return text.strip(" -|")


def parse_int(value: str):
    text = str(value or "").replace(",", "")
    numbers = re.findall(r"\d+", text)
    return int(numbers[0]) if numbers else None


def parse_range(value: str):
    numbers = [int(x) for x in re.findall(r"\d+", str(value or "").replace(",", ""))]
    if not numbers:
        return (None, None)
    if len(numbers) == 1:
        return (numbers[0], numbers[0])
    return (min(numbers[0], numbers[1]), max(numbers[0], numbers[1]))


def parse_decimal(value: str):
    match = re.search(r"\d+(?:\.\d+)?", str(value or ""))
    return float(match.group(0)) if match else None


def parse_fee(value: str):
    text = str(value or "").lower()
    return 0 if "free" in text else parse_int(text)


def must_visit(value: str) -> bool:
    return "yes" in str(value or "").lower()


def open_xlsx_bytes(blob: bytes):
    z = zipfile.ZipFile(io.BytesIO(blob))
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}

    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        ss = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in ss.findall("a:si", NS):
            shared.append("".join(t.text or "" for t in si.findall(".//a:t", NS)))

    sheets = []
    for s in wb.find("a:sheets", NS).findall("a:sheet", NS):
        rid = s.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
        target = rel_map[rid]
        if not target.startswith("worksheets/"):
            target = "worksheets/" + target.split("/")[-1]
        sheets.append((s.attrib["name"], "xl/" + target))
    return z, sheets, shared


def cell_value(cell, shared):
    cell_type = cell.attrib.get("t")
    value = cell.find("a:v", NS)
    if value is None:
        inline = cell.find("a:is", NS)
        if inline is not None:
            return "".join(x.text or "" for x in inline.findall(".//a:t", NS))
        return ""
    raw = value.text or ""
    if cell_type == "s":
        try:
            return shared[int(raw)]
        except Exception:
            return raw
    return raw


def rows_for_sheet(root, shared):
    return [
        [clean_text(cell_value(cell, shared)) for cell in row.findall("a:c", NS)]
        for row in root.findall(".//a:sheetData/a:row", NS)
    ]


STATE_NAME_FIXES = {
    "andhra": "Andhra Pradesh",
    "andhapradesh": "Andhra Pradesh",
    "arunachalpradesh": "Arunachal Pradesh",
    "assam": "Assam",
    "bihar": "Bihar",
    "chandigarh": "Chandigarh",
    "chattisgarh": "Chhattisgarh",
    "cg": "Chhattisgarh",
    "delhi": "Delhi",
    "goa": "Goa",
    "gujarat": "Gujarat",
    "haryana": "Haryana",
    "himachalpradesh": "Himachal Pradesh",
    "himalchalpradesh": "Himachal Pradesh",
    "jammuandkashmir": "Jammu and Kashmir",
    "jammukashmir": "Jammu and Kashmir",
    "jamuandkashmir": "Jammu and Kashmir",
    "jharkhand": "Jharkhand",
    "karnataka": "Karnataka",
    "karanatak": "Karnataka",
    "kerala": "Kerala",
    "kerela": "Kerala",
    "ladakh": "Ladakh",
    "maharashtra": "Maharashtra",
    "maharastha": "Maharashtra",
    "manipur": "Manipur",
    "meghalaya": "Meghalaya",
    "mizoram": "Mizoram",
    "mp": "Madhya Pradesh",
    "nagaland": "Nagaland",
    "odisha": "Odisha",
    "punjab": "Punjab",
    "rajasthan": "Rajasthan",
    "rajathan": "Rajasthan",
    "sikkim": "Sikkim",
    "telangana": "Telangana",
    "tn": "Tamil Nadu",
    "tamilnadu": "Tamil Nadu",
    "tripura": "Tripura",
    "up": "Uttar Pradesh",
    "uttarakhand": "Uttarakhand",
    "uttarkhand": "Uttarakhand",
    "westbengal": "West Bengal",
}


def infer_state_name(file_name: str, sample_rows, outer_name: str = ""):
    base_source = outer_name or file_name
    base = Path(base_source).stem
    base_key = re.sub(r"[^a-z]", "", base.lower())
    for key, value in STATE_NAME_FIXES.items():
        if base_key.startswith(key):
            return value

    joined = " ".join(" ".join(row) for row in sample_rows[:4])
    match = re.search(r"([A-Za-z][A-Za-z ]+?)\s+(?:\d+\s+)?DISTRICTS?", joined, re.IGNORECASE)
    if match:
        return clean_name(match.group(1)).title()

    base = re.sub(r"[_-]+", " ", base)
    base = re.sub(r"\b\d+\s*Districts?\b.*", "", base, flags=re.IGNORECASE)
    return clean_name(base).title()


def infer_workbook_kind(name: str):
    lower = name.lower()
    if "itinerary" in lower:
        return "itinerary"
    if "hotel" in lower:
        return "hotels"
    if "transport" in lower:
        return "transport"
    if "budget" in lower or "10days" in lower:
        return "budget"
    return None


def is_skip_sheet(name: str):
    lower = clean_text(name).lower()
    return lower in {
        "cover",
        "guide",
        "sheet",
        "how to use",
        "distance matrix",
        "distance matrix (km)",
        "bus fare matrix",
        "train fare matrix",
        "full matrix (day 1 budget)",
        "full matrix - budget day1",
    }


def parse_itinerary(state, sheets, workbook, shared, places):
    for sheet_name, target in sheets:
        if is_skip_sheet(sheet_name):
            continue
        district = clean_name(sheet_name)
        if not district:
            continue

        root = ET.fromstring(workbook.read(target))
        for row in rows_for_sheet(root, shared):
            if len(row) < 6 or not row[0].isdigit():
                continue
            place_name = clean_text(row[1])
            if not place_name:
                continue
            places.append(
                {
                    "state": state,
                    "district": district,
                    "destination": district,
                    "name": place_name,
                    "category": clean_text(row[2] or "tourist_attraction"),
                    "description": clean_text(row[3]),
                    "address": f"{district}, {state}",
                    "entry_fee": parse_fee(row[4]),
                    "must_visit": must_visit(row[5]),
                    "map_url": f"https://maps.google.com/?q={quote_plus(place_name + ' ' + district + ' ' + state)}",
                }
            )


def parse_hotels(state, sheets, workbook, shared, hotels):
    for sheet_name, target in sheets:
        if is_skip_sheet(sheet_name):
            continue
        district = clean_name(sheet_name)
        if not district:
            continue

        root = ET.fromstring(workbook.read(target))
        for row in rows_for_sheet(root, shared):
            if len(row) < 14 or not row[0].isdigit():
                continue
            hotel_name = clean_text(row[1])
            category = clean_text(row[2]).lower()
            if not hotel_name or category not in {"budget", "comfort", "luxury"}:
                continue
            price_min, price_max = parse_range(row[5])
            hotels.append(
                {
                    "state": state,
                    "district": district,
                    "hotel_name": hotel_name,
                    "category": category,
                    "star_rating": parse_decimal(row[3]),
                    "area": clean_text(row[4]),
                    "price_min": price_min,
                    "price_max": price_max,
                    "room_types": clean_text(row[6]) if len(row) > 6 else "",
                    "amenities": clean_text(row[7]) if len(row) > 7 else "",
                    "restaurant": clean_text(row[8]) if len(row) > 8 else "",
                    "ac_heating": clean_text(row[9]) if len(row) > 9 else "",
                    "parking": clean_text(row[10]) if len(row) > 10 else "",
                    "wifi": clean_text(row[11]) if len(row) > 11 else "",
                    "book_via": clean_text(row[12]) if len(row) > 12 else "",
                    "best_for": clean_text(row[13]) if len(row) > 13 else "",
                    "rating": parse_decimal(row[14]) if len(row) > 14 else None,
                }
            )


def parse_transport(state, sheets, workbook, shared, routes):
    for sheet_name, target in sheets:
        if is_skip_sheet(sheet_name):
            continue
        source = clean_name(sheet_name)
        if not source:
            continue

        root = ET.fromstring(workbook.read(target))
        for row in rows_for_sheet(root, shared):
            if len(row) < 15:
                continue
            if row[0].lower() in {"to district", "destination"} or "transport to all" in row[0].lower():
                continue
            destination = clean_name(row[0])
            if not destination or destination.lower() == "origin":
                continue

            if len(row) >= 18:
                flight_airport_from = clean_text(row[13])
                flight_airport_to = clean_text(row[14])
                flight_fare = clean_text(row[15])
                flight_time = clean_text(row[16])
                best_route = clean_text(row[17])
            else:
                flight_airport_from = ""
                flight_airport_to = clean_text(row[13]) if len(row) > 13 else ""
                flight_fare = clean_text(row[14]) if len(row) > 14 else ""
                flight_time = ""
                best_route = clean_text(row[15]) if len(row) > 15 else ""

            taxi_min, taxi_max = parse_range(row[5] if len(row) > 5 else "")
            routes.append(
                {
                    "state": state,
                    "source_district": source,
                    "destination_district": destination,
                    "distance_km": parse_int(row[1]) if len(row) > 1 else None,
                    "bus_time": clean_text(row[2]) if len(row) > 2 else "",
                    "bus_tnstc_fare": clean_text(row[3]) if len(row) > 3 else "",
                    "bus_setc_ac_fare": clean_text(row[4]) if len(row) > 4 else "",
                    "taxi_fare_text": clean_text(row[5]) if len(row) > 5 else "",
                    "taxi_fare_min": taxi_min,
                    "taxi_fare_max": taxi_max,
                    "taxi_time": clean_text(row[6]) if len(row) > 6 else "",
                    "train_available": clean_text(row[7]) if len(row) > 7 else "",
                    "train_station_from": clean_text(row[8]) if len(row) > 8 else "",
                    "train_station_to": clean_text(row[9]) if len(row) > 9 else "",
                    "train_fare_text": clean_text(row[10]) if len(row) > 10 else "",
                    "train_time": clean_text(row[11]) if len(row) > 11 else "",
                    "flight_available": clean_text(row[12]) if len(row) > 12 else "",
                    "flight_airport_from": flight_airport_from,
                    "flight_airport_to": flight_airport_to,
                    "flight_fare_text": flight_fare,
                    "flight_time": flight_time,
                    "best_route": best_route,
                }
            )


def day_totals_for_group(values):
    count = len(values)
    if count == 8:
        return [("day1_total", values[2]), ("day2_total", values[3]), ("day3_total", values[4]), ("day5_total", values[5]), ("day7_total", values[6]), ("day10_total", values[7])]
    if count == 12:
        return [
            ("day1_total", values[2]),
            ("day2_total", values[3]),
            ("day3_total", values[4]),
            ("day4_total", values[5]),
            ("day5_total", values[6]),
            ("day6_total", values[7]),
            ("day7_total", values[8]),
            ("day8_total", values[9]),
            ("day9_total", values[10]),
            ("day10_total", values[11]),
        ]
    totals = [("day1_total", values[2] if len(values) > 2 else None)]
    if len(values) > 3:
        totals.append(("day2_total", values[3]))
    if len(values) > 4:
        totals.append(("day3_total", values[4]))
    return totals


def parse_budget(state, sheets, workbook, shared, costs):
    for sheet_name, target in sheets:
        if is_skip_sheet(sheet_name):
            continue
        source = clean_name(sheet_name)
        if not source:
            continue

        root = ET.fromstring(workbook.read(target))
        for row in rows_for_sheet(root, shared):
            if len(row) < 10 or not row[0].isdigit():
                continue

            destination = clean_name(row[1])
            if not destination:
                continue

            lead_columns = 3 if (len(row) - 3) % 3 == 0 else 2
            groups = row[lead_columns:]
            if len(groups) % 3 != 0:
                continue
            group_size = len(groups) // 3
            for tier_name, offset in [("budget", 0), ("comfort", group_size), ("luxury", group_size * 2)]:
                group = groups[offset : offset + group_size]
                if len(group) < 3:
                    continue
                record = {
                    "state": state,
                    "source_district": source,
                    "destination_district": destination,
                    "tier": tier_name,
                    "travel_cost": parse_int(group[0]),
                    "stay_per_day": parse_int(group[1]),
                    "day1_total": None,
                    "day2_total": None,
                    "day3_total": None,
                    "day4_total": None,
                    "day5_total": None,
                    "day6_total": None,
                    "day7_total": None,
                    "day8_total": None,
                    "day9_total": None,
                    "day10_total": None,
                }
                for key, value in day_totals_for_group(group):
                    record[key] = parse_int(value)
                costs.append(record)


def build_dataset(source_dir: Path):
    dataset = {
        "generated_at": "",
        "source_dir": str(source_dir),
        "states": [],
        "places": [],
        "hotels": [],
        "transport_costs": [],
        "transport_routes": [],
    }
    states = set()

    for zip_path in sorted(source_dir.glob("*.zip")):
        with zipfile.ZipFile(zip_path) as outer_zip:
            for workbook_name in [name for name in outer_zip.namelist() if name.lower().endswith(".xlsx")]:
                kind = infer_workbook_kind(workbook_name)
                if not kind:
                    continue
                workbook, sheets, shared = open_xlsx_bytes(outer_zip.read(workbook_name))
                sample_rows = rows_for_sheet(ET.fromstring(workbook.read(sheets[0][1])), shared)
                state = infer_state_name(workbook_name, sample_rows, zip_path.name)
                if not state:
                    continue
                states.add(state)

                if kind == "itinerary":
                    parse_itinerary(state, sheets, workbook, shared, dataset["places"])
                elif kind == "hotels":
                    parse_hotels(state, sheets, workbook, shared, dataset["hotels"])
                elif kind == "transport":
                    parse_transport(state, sheets, workbook, shared, dataset["transport_routes"])
                elif kind == "budget":
                    parse_budget(state, sheets, workbook, shared, dataset["transport_costs"])

    dataset["generated_at"] = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    dataset["states"] = sorted(states)
    return dataset


def main():
    parser = argparse.ArgumentParser(description="Compile travel Excel ZIP datasets into a single JSON backend file.")
    parser.add_argument("--source-dir", required=True)
    parser.add_argument("--out", default="db/compiled/india-travel-data.json")
    args = parser.parse_args()

    dataset = build_dataset(Path(args.source_dir))
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {out_path}")
    print(
        json.dumps(
            {
                "states": len(dataset["states"]),
                "places": len(dataset["places"]),
                "hotels": len(dataset["hotels"]),
                "transport_costs": len(dataset["transport_costs"]),
                "transport_routes": len(dataset["transport_routes"]),
            }
        )
    )


if __name__ == "__main__":
    main()
