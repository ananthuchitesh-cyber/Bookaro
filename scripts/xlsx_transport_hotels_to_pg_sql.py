#!/usr/bin/env python3
import argparse
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def sql_str(v: str) -> str:
    return "'" + (v or "").replace("'", "''") + "'"


def clean_text(v: str) -> str:
    return re.sub(r"\s+", " ", (v or "").strip())


def clean_district(v: str) -> str:
    # Remove emoji/symbols while keeping letters, numbers, spaces, dot, ampersand, and hyphen.
    cleaned = re.sub(r"[^A-Za-z0-9 .&-]", " ", (v or ""))
    return clean_text(cleaned)


def parse_money(v: str):
    s = (v or "").strip().replace(",", "")
    if not s or s in {"-", "—"}:
        return "NULL"
    m = re.findall(r"\d+", s)
    if not m:
        return "NULL"
    return str(int(m[0]))


def parse_price_range(v: str):
    s = (v or "").replace(",", "")
    nums = [int(x) for x in re.findall(r"\d+", s)]
    if not nums:
        return ("NULL", "NULL")
    if len(nums) == 1:
        return (str(nums[0]), str(nums[0]))
    return (str(min(nums[0], nums[1])), str(max(nums[0], nums[1])))


def parse_rating(v: str):
    s = (v or "").strip()
    if not s:
        return "NULL"
    m = re.search(r"\d+(\.\d+)?", s)
    return m.group(0) if m else "NULL"


def parse_star(v: str):
    s = (v or "").strip()
    if not s:
        return "NULL"
    m = re.search(r"\d+(\.\d+)?", s)
    return m.group(0) if m else "NULL"


def open_xlsx(path: str):
    z = zipfile.ZipFile(path)
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
        name = s.attrib["name"]
        rid = s.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
        target = rel_map[rid]
        if not target.startswith("worksheets/"):
            target = "worksheets/" + target.split("/")[-1]
        sheets.append((name, "xl/" + target))
    return z, sheets, shared


def cell_value(cell, shared):
    t = cell.attrib.get("t")
    v = cell.find("a:v", NS)
    if v is None:
        i = cell.find("a:is", NS)
        if i is not None:
            return "".join(x.text or "" for x in i.findall(".//a:t", NS))
        return ""
    val = v.text or ""
    if t == "s":
        try:
            return shared[int(val)]
        except Exception:
            return val
    return val


def row_values(row, shared):
    values = []
    for c in row.findall("a:c", NS):
        values.append(cell_value(c, shared).strip())
    return values


def pad(values, n):
    if len(values) >= n:
        return values
    return values + [""] * (n - len(values))


def is_numeric_row(values):
    if len(values) < 2:
        return False
    return bool(re.match(r"^\d+$", (values[0] or "").strip()))


def transport_sql(xlsx_path: str) -> str:
    z, sheets, shared = open_xlsx(xlsx_path)
    out = []
    out.append("-- Auto-generated SQL from TN district transport workbook")
    out.append("BEGIN;")

    for sheet_name, target in sheets:
        lower_name = sheet_name.lower().strip()
        if lower_name in {"how to use", "full matrix - budget day1"}:
            continue

        source = clean_district(sheet_name)
        if not source:
            continue

        root = ET.fromstring(z.read(target))
        rows = [row_values(r, shared) for r in root.findall(".//a:sheetData/a:row", NS)]
        data_rows = [pad(r, 38) for r in rows if is_numeric_row(r) and len(r) >= 4]

        for r in data_rows:
            destination = clean_district(r[1])
            if not destination:
                continue

            tiers = [
                ("budget", 2),
                ("comfort", 14),
                ("luxury", 26),
            ]
            for tier, idx in tiers:
                travel = parse_money(r[idx + 0])
                stay = parse_money(r[idx + 1])
                d1 = parse_money(r[idx + 2])
                d2 = parse_money(r[idx + 3])
                d3 = parse_money(r[idx + 4])
                d4 = parse_money(r[idx + 5])
                d5 = parse_money(r[idx + 6])
                d6 = parse_money(r[idx + 7])
                d7 = parse_money(r[idx + 8])
                d8 = parse_money(r[idx + 9])
                d9 = parse_money(r[idx + 10])
                d10 = parse_money(r[idx + 11])

                out.append(
                    "INSERT INTO district_transport_costs "
                    "(source_district, destination_district, tier, travel_cost, stay_per_day, "
                    "day1_total, day2_total, day3_total, day4_total, day5_total, day6_total, day7_total, day8_total, day9_total, day10_total) "
                    f"VALUES ({sql_str(source)}, {sql_str(destination)}, {sql_str(tier)}, {travel}, {stay}, "
                    f"{d1}, {d2}, {d3}, {d4}, {d5}, {d6}, {d7}, {d8}, {d9}, {d10}) "
                    "ON CONFLICT (source_district, destination_district, tier) DO UPDATE SET "
                    "travel_cost = EXCLUDED.travel_cost, "
                    "stay_per_day = EXCLUDED.stay_per_day, "
                    "day1_total = EXCLUDED.day1_total, day2_total = EXCLUDED.day2_total, day3_total = EXCLUDED.day3_total, "
                    "day4_total = EXCLUDED.day4_total, day5_total = EXCLUDED.day5_total, day6_total = EXCLUDED.day6_total, "
                    "day7_total = EXCLUDED.day7_total, day8_total = EXCLUDED.day8_total, day9_total = EXCLUDED.day9_total, day10_total = EXCLUDED.day10_total;"
                )

    out.append("COMMIT;")
    return "\n".join(out) + "\n"


def hotels_sql(xlsx_path: str) -> str:
    z, sheets, shared = open_xlsx(xlsx_path)
    out = []
    out.append("-- Auto-generated SQL from TN district hotels workbook")
    out.append("BEGIN;")

    for sheet_name, target in sheets:
        if sheet_name.lower().strip() == "guide":
            continue
        district = clean_district(sheet_name)
        if not district:
            continue

        root = ET.fromstring(z.read(target))
        rows = [row_values(r, shared) for r in root.findall(".//a:sheetData/a:row", NS)]
        data_rows = [pad(r, 15) for r in rows if is_numeric_row(r) and len(r) >= 6]

        for r in data_rows:
            hotel_name = clean_text(r[1])
            category = clean_text(r[2]).lower()
            star = parse_star(r[3])
            area = clean_text(r[4])
            pmin, pmax = parse_price_range(r[5])
            room_types = clean_text(r[6])
            amenities = clean_text(r[7])
            restaurant = clean_text(r[8])
            ac_heating = clean_text(r[9])
            parking = clean_text(r[10])
            wifi = clean_text(r[11])
            book_via = clean_text(r[12])
            best_for = clean_text(r[13])
            rating = parse_rating(r[14])

            if category not in {"budget", "comfort", "luxury"}:
                continue
            if not hotel_name:
                continue

            out.append(
                "INSERT INTO district_hotels "
                "(district, hotel_name, category, star_rating, area, price_min, price_max, room_types, amenities, "
                "restaurant, ac_heating, parking, wifi, book_via, best_for, rating) "
                f"VALUES ({sql_str(district)}, {sql_str(hotel_name)}, {sql_str(category)}, {star}, {sql_str(area)}, "
                f"{pmin}, {pmax}, {sql_str(room_types)}, {sql_str(amenities)}, "
                f"{sql_str(restaurant)}, {sql_str(ac_heating)}, {sql_str(parking)}, {sql_str(wifi)}, "
                f"{sql_str(book_via)}, {sql_str(best_for)}, {rating}) "
                "ON CONFLICT (district, hotel_name) DO UPDATE SET "
                "category = EXCLUDED.category, star_rating = EXCLUDED.star_rating, area = EXCLUDED.area, "
                "price_min = EXCLUDED.price_min, price_max = EXCLUDED.price_max, room_types = EXCLUDED.room_types, "
                "amenities = EXCLUDED.amenities, restaurant = EXCLUDED.restaurant, ac_heating = EXCLUDED.ac_heating, "
                "parking = EXCLUDED.parking, wifi = EXCLUDED.wifi, book_via = EXCLUDED.book_via, "
                "best_for = EXCLUDED.best_for, rating = EXCLUDED.rating;"
            )

    out.append("COMMIT;")
    return "\n".join(out) + "\n"


def main():
    parser = argparse.ArgumentParser(description="Convert TN transport/hotels xlsx files to PostgreSQL SQL inserts.")
    parser.add_argument("--transport-xlsx", required=True)
    parser.add_argument("--hotels-xlsx", required=True)
    parser.add_argument("--transport-out", default="db/import_tn_transport.sql")
    parser.add_argument("--hotels-out", default="db/import_tn_hotels.sql")
    args = parser.parse_args()

    transport = transport_sql(args.transport_xlsx)
    hotels = hotels_sql(args.hotels_xlsx)

    Path(args.transport_out).write_text(transport, encoding="utf-8")
    Path(args.hotels_out).write_text(hotels, encoding="utf-8")
    print(f"Transport SQL written to {args.transport_out}")
    print(f"Hotels SQL written to {args.hotels_out}")


if __name__ == "__main__":
    main()
