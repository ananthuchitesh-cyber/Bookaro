#!/usr/bin/env python3
import argparse
import re
import zipfile
import xml.etree.ElementTree as ET
from urllib.parse import quote_plus

NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def sql_str(v: str) -> str:
    return "'" + (v or "").replace("'", "''") + "'"


def normalize_slug(v: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (v or "").lower()).strip("-")


def parse_fee(v: str):
    if not v:
        return "NULL"
    s = str(v).lower()
    if "free" in s:
        return "0"
    digits = re.sub(r"[^0-9]", "", s)
    return digits if digits else "NULL"


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


def is_data_row(vals):
    if len(vals) < 6:
        return False
    return vals[0].isdigit() and bool(vals[1])


def must_visit(v: str) -> bool:
    s = (v or "").lower()
    return "⭐" in s or "yes" in s


def generate_sql(xlsx_path: str) -> str:
    z, sheets, shared = open_xlsx(xlsx_path)
    lines = []
    lines.append("-- Auto-generated SQL from Tamil Nadu itinerary workbook")
    lines.append("BEGIN;")

    for sheet_name, target in sheets:
        if sheet_name.lower() == "sheet":
            continue
        root = ET.fromstring(z.read(target))
        rows = root.findall(".//a:sheetData/a:row", NS)
        parsed_rows = [row_values(r, shared) for r in rows]
        data_rows = [r for r in parsed_rows if is_data_row(r)]
        if not data_rows:
            continue

        dest_name = sheet_name.strip()
        slug = normalize_slug(dest_name)
        lines.append(
            f"INSERT INTO destinations (name, state, slug) VALUES ({sql_str(dest_name)}, 'Tamil Nadu', {sql_str(slug)}) "
            f"ON CONFLICT (name) DO NOTHING;"
        )

        for r in data_rows:
            place_name = r[1]
            category = r[2] or "tourist_attraction"
            description = r[3] or ""
            fee = parse_fee(r[4])
            is_must = "TRUE" if must_visit(r[5]) else "FALSE"
            maps = f"https://maps.google.com/?q={quote_plus(place_name + ' ' + dest_name)}"
            address = f"{dest_name}, Tamil Nadu"

            lines.append(
                "INSERT INTO tourist_places (destination_id, district, name, category, description, address, entry_fee, must_visit, map_url) "
                "SELECT d.id, "
                f"{sql_str(dest_name)}, {sql_str(place_name)}, {sql_str(category)}, {sql_str(description)}, "
                f"{sql_str(address)}, {fee}, {is_must}, {sql_str(maps)} "
                "FROM destinations d "
                f"WHERE d.name = {sql_str(dest_name)} "
                "AND NOT EXISTS (SELECT 1 FROM tourist_places tp WHERE tp.destination_id = d.id AND lower(tp.name) = lower("
                f"{sql_str(place_name)}"
                "));"
            )

    lines.append("COMMIT;")
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description="Convert TN itinerary xlsx to PostgreSQL SQL inserts.")
    parser.add_argument("xlsx_path")
    parser.add_argument("--out", default="db/import_tamil_nadu.sql")
    args = parser.parse_args()
    sql = generate_sql(args.xlsx_path)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(sql)
    print(f"SQL written to {args.out}")


if __name__ == "__main__":
    main()

