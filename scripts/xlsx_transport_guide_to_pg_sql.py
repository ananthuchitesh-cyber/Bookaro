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
    cleaned = re.sub(r"[^A-Za-z0-9 .&-]", " ", (v or ""))
    return clean_text(cleaned)


def parse_int(v: str):
    s = re.sub(r"[^0-9]", "", (v or ""))
    return s if s else "NULL"


def parse_range(v: str):
    nums = [int(x) for x in re.findall(r"\d+", (v or "").replace(",", ""))]
    if not nums:
        return ("NULL", "NULL")
    if len(nums) == 1:
        n = str(nums[0])
        return (n, n)
    return (str(min(nums[0], nums[1])), str(max(nums[0], nums[1])))


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
    return [cell_value(c, shared).strip() for c in row.findall("a:c", NS)]


def pad(values, n):
    return values + [""] * max(0, n - len(values))


def is_data_row(r):
    if len(r) < 18:
        return False
    first = clean_text(r[0])
    if not first:
        return False
    if first.lower() == "to district":
        return False
    if "transport to all" in first.lower():
        return False
    return True


def generate_sql(xlsx_path: str) -> str:
    z, sheets, shared = open_xlsx(xlsx_path)
    out = []
    out.append("-- Auto-generated SQL from TN transport guide workbook")
    out.append("BEGIN;")

    skip = {"how to use", "distance matrix", "bus fare matrix", "train fare matrix"}

    for sheet_name, target in sheets:
        if sheet_name.lower().strip() in skip:
            continue

        source = clean_district(sheet_name)
        if not source:
            continue

        root = ET.fromstring(z.read(target))
        rows = [pad(row_values(r, shared), 18) for r in root.findall(".//a:sheetData/a:row", NS)]
        data_rows = [r for r in rows if is_data_row(r)]

        for r in data_rows:
            destination = clean_district(r[0])
            if not destination:
                continue

            distance_km = parse_int(r[1])
            taxi_min, taxi_max = parse_range(r[5])

            out.append(
                "INSERT INTO district_transport_routes "
                "(source_district, destination_district, distance_km, bus_time, bus_tnstc_fare, bus_setc_ac_fare, "
                "taxi_fare_text, taxi_fare_min, taxi_fare_max, taxi_time, train_available, train_station_from, "
                "train_station_to, train_fare_text, train_time, flight_available, flight_airport_from, flight_airport_to, "
                "flight_fare_text, flight_time, best_route) "
                f"VALUES ({sql_str(source)}, {sql_str(destination)}, {distance_km}, {sql_str(clean_text(r[2]))}, "
                f"{sql_str(clean_text(r[3]))}, {sql_str(clean_text(r[4]))}, {sql_str(clean_text(r[5]))}, "
                f"{taxi_min}, {taxi_max}, {sql_str(clean_text(r[6]))}, {sql_str(clean_text(r[7]))}, "
                f"{sql_str(clean_text(r[8]))}, {sql_str(clean_text(r[9]))}, {sql_str(clean_text(r[10]))}, "
                f"{sql_str(clean_text(r[11]))}, {sql_str(clean_text(r[12]))}, {sql_str(clean_text(r[13]))}, "
                f"{sql_str(clean_text(r[14]))}, {sql_str(clean_text(r[15]))}, {sql_str(clean_text(r[16]))}, "
                f"{sql_str(clean_text(r[17]))}) "
                "ON CONFLICT (source_district, destination_district) DO UPDATE SET "
                "distance_km = EXCLUDED.distance_km, bus_time = EXCLUDED.bus_time, "
                "bus_tnstc_fare = EXCLUDED.bus_tnstc_fare, bus_setc_ac_fare = EXCLUDED.bus_setc_ac_fare, "
                "taxi_fare_text = EXCLUDED.taxi_fare_text, taxi_fare_min = EXCLUDED.taxi_fare_min, taxi_fare_max = EXCLUDED.taxi_fare_max, "
                "taxi_time = EXCLUDED.taxi_time, train_available = EXCLUDED.train_available, train_station_from = EXCLUDED.train_station_from, "
                "train_station_to = EXCLUDED.train_station_to, train_fare_text = EXCLUDED.train_fare_text, train_time = EXCLUDED.train_time, "
                "flight_available = EXCLUDED.flight_available, flight_airport_from = EXCLUDED.flight_airport_from, "
                "flight_airport_to = EXCLUDED.flight_airport_to, flight_fare_text = EXCLUDED.flight_fare_text, "
                "flight_time = EXCLUDED.flight_time, best_route = EXCLUDED.best_route;"
            )

    out.append("COMMIT;")
    return "\n".join(out) + "\n"


def main():
    parser = argparse.ArgumentParser(description="Convert TN transport guide xlsx to PostgreSQL SQL inserts.")
    parser.add_argument("xlsx_path")
    parser.add_argument("--out", default="db/import_tn_transport_guide.sql")
    args = parser.parse_args()

    sql = generate_sql(args.xlsx_path)
    Path(args.out).write_text(sql, encoding="utf-8")
    print(f"SQL written to {args.out}")


if __name__ == "__main__":
    main()
