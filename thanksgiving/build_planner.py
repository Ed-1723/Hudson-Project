"""Build the Freeman Thanksgiving Planner workbook.

    python3 thanksgiving/build_planner.py [output.xlsx]

Layout contract (the Calc sheets read these exact cells on every recipe
tab via INDIRECT, so the template and every recipe must match):

    C4 Serves   C5 Method   C6 Oven temp   C7 Prep min   C8 Cook min
    C9 Rest min C10 Make-ahead days  C11 Advance step  C12 Advance days
    C13 Weight (lb, meats)
    A16:E45  ingredients (Qty | Unit | Ingredient | Prep | Check)
    A48:E72  steps
"""

import sys
from datetime import date, time
from pathlib import Path

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

sys.path.insert(0, str(Path(__file__).parent))
from recipes_seed import (  # noqa: E402
    COOKS, CONVERSIONS, INGREDIENTS, LEADS, MEALS, METHODS, PLAN, RECIPES,
    SECTIONS, STORES, UNITS,
)

OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "Freeman_Thanksgiving_Planner.xlsx"

N_RECIPES = 40      # dish slots on the Dish Planner
N_LINES = 30        # ingredient rows per recipe tab
N_STEPS = 25
N_MEALS = 6
N_ING = 300         # Ingredients master slots
N_CONV = 200
N_SHOP = 200
N_SCHED = 200

ING_FIRST, ING_LAST = 16, 16 + N_LINES - 1          # 16..45
STEP_FIRST, STEP_LAST = 48, 48 + N_STEPS - 1         # 48..72
PLAN_FIRST = 11                                      # dish rows 11..50
PLAN_LAST = PLAN_FIRST + N_RECIPES - 1
MEAL_COLS = [get_column_letter(4 + k) for k in range(N_MEALS)]   # D..I
MC0, MC1 = MEAL_COLS[0], MEAL_COLS[-1]
INGM_FIRST, INGM_LAST = 5, 5 + N_ING - 1             # Ingredients 5..304
CONV_FIRST, CONV_LAST = 5, 5 + N_CONV - 1
CALC_LINE_FIRST = 50
CALC_LINE_LAST = CALC_LINE_FIRST + N_RECIPES * N_LINES - 1   # 50..1249
SCH_MAIN = 2
SCH_ADV = SCH_MAIN + N_RECIPES * N_MEALS             # 242
SCH_MEAL = SCH_ADV + N_RECIPES * N_MEALS             # 482
SCH_LAST = SCH_MEAL + N_MEALS - 1                    # 487

# ---------------------------------------------------------------- styles
FONT = "Arial"
C_DARK = "6B2E0E"     # deep roast brown
C_ACCENT = "C2571A"   # pumpkin
C_SOFT = "F6E7D8"     # light parchment
C_INPUT = "FFF2CC"    # yellow = edit me
C_CALC = "F2F2F2"     # grey = formula, leave alone
C_LINE = "D9C3AE"

f_base = Font(name=FONT, size=10)
f_bold = Font(name=FONT, size=10, bold=True)
f_title = Font(name=FONT, size=18, bold=True, color=C_DARK)
f_sub = Font(name=FONT, size=10, italic=True, color="7F6A5A")
f_head = Font(name=FONT, size=10, bold=True, color="FFFFFF")
f_section = Font(name=FONT, size=11, bold=True, color=C_ACCENT)
fill_head = PatternFill("solid", fgColor=C_DARK)
fill_input = PatternFill("solid", fgColor=C_INPUT)
fill_calc = PatternFill("solid", fgColor=C_CALC)
fill_soft = PatternFill("solid", fgColor=C_SOFT)
thin = Side(style="thin", color=C_LINE)
box = Border(left=thin, right=thin, top=thin, bottom=thin)
wrap_top = Alignment(wrap_text=True, vertical="top")
center = Alignment(horizontal="center", vertical="center")

TIME_FMT = "h:mm AM/PM"
DAY_FMT = "ddd m/d"
DT_FMT = "ddd m/d h:mm AM/PM"


def style_range(ws, ref, font=None, fill=None, border=None, align=None, fmt=None):
    for row in ws[ref]:
        for c in row:
            if font: c.font = font
            if fill: c.fill = fill
            if border: c.border = border
            if align: c.alignment = align
            if fmt: c.number_format = fmt


def header_row(ws, row, labels, start_col=1):
    for k, lab in enumerate(labels):
        c = ws.cell(row=row, column=start_col + k, value=lab)
        c.font = f_head
        c.fill = fill_head
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = box


def widths(ws, spec):
    for col, w in spec.items():
        ws.column_dimensions[col].width = w


def add_list_validation(ws, ref, source, allow_other=False, prompt=None):
    dv = DataValidation(type="list", formula1=source, allow_blank=True)
    if allow_other:
        dv.errorStyle = "warning"
        dv.error = "Not in the list. That's OK if you meant it, but the shopping list won't find it until you add it to the Ingredients tab."
        dv.errorTitle = "Not in list"
    if prompt:
        dv.prompt = prompt
        dv.showInputMessage = True
    ws.add_data_validation(dv)
    dv.add(ref)


def set_base_font(ws, max_row, max_col):
    for row in ws.iter_rows(min_row=1, max_row=max_row, max_col=max_col):
        for c in row:
            if c.font is None or c.font.name != FONT:
                c.font = Font(name=FONT, size=c.font.size if c.font and c.font.size else 10,
                              bold=c.font.bold if c.font else False,
                              italic=c.font.italic if c.font else False,
                              color=c.font.color if c.font else None)


def q(name):
    return "'" + name.replace("'", "''") + "'"


wb = Workbook()
ws_start = wb.active
ws_start.title = "Start Here"
ws_plan = wb.create_sheet("Dish Planner")
ws_sched = wb.create_sheet("Cook Schedule")
ws_shop = wb.create_sheet("Shopping List")
ws_ing = wb.create_sheet("Ingredients")
ws_conv = wb.create_sheet("Conversions")
recipe_sheets = [wb.create_sheet(r["name"]) for r in RECIPES]
ws_tpl = wb.create_sheet("_Template")
ws_lists = wb.create_sheet("Lists")
ws_calc = wb.create_sheet("Calc")
ws_cs = wb.create_sheet("CalcSched")

PL = q("Dish Planner")

# ================================================================= Lists
L = ws_lists
L["A1"], L["B1"], L["C1"], L["D1"], L["E1"] = "Stores", "Store order / filter", "Sections (store order)", "Cooks", "Cook methods"
L["F1"], L["G1"], L["H1"], L["I1"], L["J1"], L["K1"] = "Meal filter", "Cook filter", "Unit", "Family", "Size (tsp / oz)", "Yes/No"
header_row(L, 1, [L.cell(1, c).value for c in range(1, 12)])
for k in range(8):                      # A2:A9 stores, A10 Skip
    L.cell(2 + k, 1, STORES[k] if k < len(STORES) else None)
L["A10"] = "Skip"
L["B2"] = "All"
for k in range(8):                      # B3:B10 mirror stores
    L.cell(3 + k, 2, f'=IF(A{2 + k}="","",A{2 + k})')
L["B11"], L["B12"] = "Unassigned", "Pantry check"
for k, s in enumerate(SECTIONS):
    L.cell(2 + k, 3, s)
for k in range(10):
    L.cell(2 + k, 4, COOKS[k] if k < len(COOKS) else None)
for k, m in enumerate(METHODS):
    L.cell(2 + k, 5, m)
L["F2"] = "All"
for k in range(N_MEALS):
    L.cell(3 + k, 6, f'=IF({PL}!{MEAL_COLS[k]}4="","",{PL}!{MEAL_COLS[k]}4)')
L["G2"] = "All"
for k in range(10):
    L.cell(3 + k, 7, f'=IF(D{2 + k}="","",D{2 + k})')
for k, (u, fam, size) in enumerate(UNITS):
    L.cell(2 + k, 8, u)
    L.cell(2 + k, 9, fam)
    L.cell(2 + k, 10, size)
L["K2"], L["K3"] = "Yes", "No"
UNIT_LAST = 2 + len(UNITS) - 1 + 10     # room for added units
for r in range(2, UNIT_LAST + 1):
    for c in (1, 3, 4, 5, 8, 9, 10):
        L.cell(r, c).fill = fill_input
widths(L, {"A": 16, "B": 20, "C": 22, "D": 12, "E": 16, "F": 14, "G": 12, "H": 10, "I": 10, "J": 14, "K": 8})
L["M1"] = "Yellow cells are editable: add stores (A2:A9), cooks (D2:D11), or units (H/I/J). Grey columns are formulas."
L["M1"].font = f_sub
L.freeze_panes = "A2"
STORE_LIST = "Lists!$A$2:$A$10"
STORE_FILTER = "Lists!$B$2:$B$12"
SECTION_LIST = f"Lists!$C$2:$C${1 + len(SECTIONS) + 4}"
COOK_LIST = "Lists!$D$2:$D$11"
METHOD_LIST = "Lists!$E$2:$E$8"
MEAL_FILTER = f"Lists!$F$2:$F${2 + N_MEALS}"
COOK_FILTER = "Lists!$G$2:$G$12"
UNIT_LIST = f"Lists!$H$2:$H${UNIT_LAST}"
UNIT_TBL = f"Lists!$H$2:$J${UNIT_LAST}"
YN = "Lists!$K$2:$K$3"

# =========================================================== Ingredients
I = ws_ing
I["A1"] = "Ingredients"
I["A1"].font = f_title
I["A2"] = ("Every ingredient a recipe uses lives here once. Set the store you buy it at, whether it's a pantry staple "
           "(Y = just check the pantry), and add extras that aren't in any recipe (foil, wine, ice). "
           "Yellow = yours to edit. Grey = calculated.")
I["A2"].font = f_sub
I.merge_cells("A2:L2")
I["A2"].alignment = wrap_top
I.row_dimensions[2].height = 28
header_row(I, 4, ["Ingredient", "Buy unit", "Section", "Store", "Pantry staple? (Y)", "Extra qty (manual add)",
                  "Package note", "Got it (x)", "Need (buy units)", "Buy", "Shows as", "sort key", "got?"])
ings = sorted(INGREDIENTS, key=lambda t: (SECTIONS.index(t[2]), t[0].lower()))
for r in range(INGM_FIRST, INGM_LAST + 1):
    k = r - INGM_FIRST
    if k < len(ings):
        name, unit, sec, store, pantry, note = ings[k]
        I.cell(r, 1, name); I.cell(r, 2, unit); I.cell(r, 3, sec); I.cell(r, 4, store)
        I.cell(r, 5, pantry or None); I.cell(r, 7, note or None)
    # I need, J buy, K shows-as store, L sort key, M got flag
    I.cell(r, 9, f'=IF(A{r}="","",SUMIFS(Calc!$R${CALC_LINE_FIRST}:$R${CALC_LINE_LAST},Calc!$H${CALC_LINE_FIRST}:$H${CALC_LINE_LAST},A{r})+N(F{r}))')
    I.cell(r, 10, f'=IF(A{r}="","",IF(I{r}<=0,0,IF(UPPER(E{r})="Y",ROUND(I{r},2),ROUNDUP(ROUND(I{r},3),0))))')
    I.cell(r, 11, f'=IF(A{r}="","",IF(D{r}="Skip","Skip",IF(UPPER(E{r})="Y","Pantry check",IF(D{r}="","Unassigned",D{r}))))')
    I.cell(r, 13, f'=AND(H{r}<>"",H{r}<>FALSE)')
    I.cell(r, 12, (f'=IF(OR(A{r}="",K{r}="Skip",N(J{r})<=0,AND({q("Shopping List")}!$C$4="Yes",M{r})),"",'
                   f'IF(OR({q("Shopping List")}!$C$3="All",{q("Shopping List")}!$C$3=K{r}),'
                   f'IFERROR(MATCH(K{r},{STORE_FILTER},0),20)*100000+IFERROR(MATCH(C{r},{SECTION_LIST},0),50)*1000+ROW(),""))'))
    for c in range(1, 9):
        I.cell(r, c).fill = fill_input
        I.cell(r, c).border = box
    for c in range(9, 14):
        I.cell(r, c).fill = fill_calc
        I.cell(r, c).border = box
    I.cell(r, 9).number_format = "0.##"
    I.cell(r, 10).number_format = "0.##"
widths(I, {"A": 30, "B": 10, "C": 18, "D": 15, "E": 10, "F": 11, "G": 34, "H": 8, "I": 11, "J": 8, "K": 14, "L": 10, "M": 7})
I.column_dimensions["L"].hidden = True
I.column_dimensions["M"].hidden = True
I.freeze_panes = "B5"
I.auto_filter.ref = f"A4:K{INGM_LAST}"
add_list_validation(I, f"B{INGM_FIRST}:B{INGM_LAST}", UNIT_LIST)
add_list_validation(I, f"C{INGM_FIRST}:C{INGM_LAST}", SECTION_LIST)
add_list_validation(I, f"D{INGM_FIRST}:D{INGM_LAST}", STORE_LIST)
I["E4"].comment = Comment("Y = you normally have it (spices, flour, salt). It shows in a 'Pantry check' group with the exact amount instead of rounding up to a purchase.", "Planner")
I["H4"].comment = Comment("Type x (or insert a checkbox) once it's in the cart. Turn on 'Hide got-it items' on the Shopping List to drop them.", "Planner")
I["B4"].comment = Comment("The unit the shopping list totals in. Recipe units convert to this automatically for volume (tsp/Tbsp/cup) and weight (oz/lb); anything else needs a row on the Conversions tab.", "Planner")

# =========================================================== Conversions
C = ws_conv
C["A1"] = "Conversions"
C["A1"].font = f_title
C["A2"] = ("Only needed when a recipe unit can't be converted automatically, like cups of diced onion → whole onions or "
           "Tbsp of butter → sticks. Volume↔volume and weight↔weight convert on their own. "
           "If the Shopping List says 'No conversion', add a row here.")
C["A2"].font = f_sub
C.merge_cells("A2:F2")
C["A2"].alignment = wrap_top
C.row_dimensions[2].height = 40
header_row(C, 4, ["Ingredient", "Recipe unit", "1 recipe unit =", "Buy unit", "Example", "key"])
for r in range(CONV_FIRST, CONV_LAST + 1):
    k = r - CONV_FIRST
    if k < len(CONVERSIONS):
        a, b, v = CONVERSIONS[k]
        C.cell(r, 1, a); C.cell(r, 2, b); C.cell(r, 3, v)
    C.cell(r, 4, f'=IF(A{r}="","",IFERROR(INDEX(Ingredients!$B${INGM_FIRST}:$B${INGM_LAST},MATCH(A{r},Ingredients!$A${INGM_FIRST}:$A${INGM_LAST},0)),"⚠ not in Ingredients"))')
    C.cell(r, 5, f'=IF(A{r}="","","1 "&B{r}&" "&LOWER(A{r})&" = "&ROUND(C{r},3)&" "&D{r})')
    C.cell(r, 6, f'=IF(A{r}="","",A{r}&"|"&B{r})')
    for c in range(1, 4):
        C.cell(r, c).fill = fill_input; C.cell(r, c).border = box
    for c in range(4, 7):
        C.cell(r, c).fill = fill_calc; C.cell(r, c).border = box
    C.cell(r, 3).number_format = "0.###"
widths(C, {"A": 30, "B": 12, "C": 15, "D": 18, "E": 48, "F": 10})
C.column_dimensions["F"].hidden = True
C.freeze_panes = "A5"
add_list_validation(C, f"A{CONV_FIRST}:A{CONV_LAST}", f"Ingredients!$A${INGM_FIRST}:$A${INGM_LAST}", allow_other=True)
add_list_validation(C, f"B{CONV_FIRST}:B{CONV_LAST}", UNIT_LIST)

# ========================================================== Recipe tabs
DETAIL_LABELS = [
    (4, "Serves"), (5, "Cook method"), (6, "Oven temp (°F)"), (7, "Prep time (min)"),
    (8, "Cook / bake (min)"), (9, "Rest / cool (min)"), (10, "Make ahead (days)"),
    (11, "Advance step"), (12, "Advance: days before"), (13, "Weight (lb), meats"),
]
DETAIL_HELP = {
    5: "Oven, Stovetop, Slow cooker, No cook, or Store-bought. Only 'Oven' is checked for oven clashes.",
    9: "Time between coming out of the oven/off the stove and being ready to serve or pack.",
    10: "0 = same day. 1 = made the day before (finished by the make-ahead time on the Dish Planner).",
    11: "Something that happens days earlier, e.g. 'Move turkey to fridge to thaw'. Shows as its own line on the Cook Schedule.",
    13: "Turkey and ham cook times are calculated from this.",
}


def build_recipe_sheet(ws, r):
    ws.sheet_properties.tabColor = C_ACCENT if r else "999999"
    widths(ws, {"A": 10, "B": 12, "C": 34, "D": 38, "E": 24})
    ws["A1"] = r["title"] if r else "New Recipe"
    ws["A1"].font = f_title
    ws["A2"] = ("Copy this tab to add a recipe: right-click the tab → Duplicate, rename it, then type the exact tab name "
                "into the next empty row on the Dish Planner." if not r else
                "Yellow = yours to edit. Qty can be 1/2, 1 1/2, .75 or 2. Who's cooking and how many batches are set on the Dish Planner.")
    ws["A2"].font = f_sub
    ws["A3"] = "DETAILS"
    ws["A3"].font = f_section
    ws["D3"] = "NOTES & TWEAKS"
    ws["D3"].font = f_section
    for row, lab in DETAIL_LABELS:
        ws.cell(row, 1, lab).font = f_base
        c = ws.cell(row, 3)
        c.fill = fill_input
        c.border = box
        c.alignment = Alignment(horizontal="left")
        if row in DETAIL_HELP:
            ws.cell(row, 1).comment = Comment(DETAIL_HELP[row], "Planner")
    if r:
        vals = {4: r["serves"], 5: r["method"], 6: r["temp"], 7: r["prep"], 8: r["cook"], 9: r["rest"],
                10: r["make_ahead"], 11: r["adv_step"], 12: r["adv_days"], 13: r["weight"]}
        for row, v in vals.items():
            if v == "" or v is None:
                continue
            ws.cell(row, 3, v)
            if isinstance(v, str) and v.startswith("="):
                ws.cell(row, 3).fill = fill_calc
                ws.cell(row, 3).comment = Comment("Calculated from the weight in C13. Overwrite with a number if you prefer.", "Planner")
    else:
        ws["C10"] = 0
    add_list_validation(ws, "C5", METHOD_LIST)
    ws.merge_cells("D4:E13")
    ws["D4"] = (r["notes"] if r else "") or None
    ws["D4"].alignment = wrap_top
    ws["D4"].fill = fill_input
    style_range(ws, "D4:E13", border=box, fill=fill_input)
    if r and r["notes"].startswith(("YOUR EDIT", "RECIPE NEEDED")):
        ws["D4"].font = Font(name=FONT, size=10, bold=True, color="9C2A00")
    else:
        ws["D4"].font = f_base

    ws["A14"] = "INGREDIENTS"
    ws["A14"].font = f_section
    header_row(ws, 15, ["Qty", "Unit", "Ingredient (pick from list)", "Prep / notes", "Check"])
    lines = r["ingredients"] if r else []
    for k, row in enumerate(range(ING_FIRST, ING_LAST + 1)):
        for col in range(1, 5):
            c = ws.cell(row, col)
            c.fill = fill_input
            c.border = box
        ws.cell(row, 1).number_format = "@"
        ws.cell(row, 1).alignment = Alignment(horizontal="center")
        if k < len(lines):
            qty, unit, ing, prep = lines[k]
            if qty.startswith("="):
                ws.cell(row, 1, qty).fill = fill_calc
                ws.cell(row, 1).number_format = "0.##"
            elif qty:
                ws.cell(row, 1, qty)
            ws.cell(row, 2, unit or None)
            ws.cell(row, 3, ing)
            ws.cell(row, 4, prep or None)
        ws.cell(row, 5, (f'=IF(C{row}="",IF(A{row}="","","⚠ Pick an ingredient"),'
                         f'IF(ISNA(MATCH(C{row},Ingredients!$A${INGM_FIRST}:$A${INGM_LAST},0)),"⚠ Add to Ingredients tab",'
                         f'IF(A{row}="","(no qty — not on list)","✓")))'))
        ws.cell(row, 5).fill = fill_calc
        ws.cell(row, 5).border = box
        ws.cell(row, 5).font = Font(name=FONT, size=9, color="7F6A5A")
    add_list_validation(ws, f"B{ING_FIRST}:B{ING_LAST}", UNIT_LIST)
    add_list_validation(ws, f"C{ING_FIRST}:C{ING_LAST}", f"Ingredients!$A${INGM_FIRST}:$A${INGM_LAST}", allow_other=True)

    ws["A47"] = "STEPS"
    ws["A47"].font = f_section
    steps = r["steps"] if r else []
    for k, row in enumerate(range(STEP_FIRST, STEP_LAST + 1)):
        ws.cell(row, 1, k + 1).alignment = Alignment(horizontal="center", vertical="top")
        ws.cell(row, 1).font = f_bold
        ws.merge_cells(start_row=row, start_column=2, end_row=row, end_column=5)
        c = ws.cell(row, 2)
        c.alignment = wrap_top
        c.fill = fill_input
        style_range(ws, f"B{row}:E{row}", border=box, fill=fill_input)
        if k < len(steps):
            c.value = steps[k]
            ws.row_dimensions[row].height = max(15, 13.5 * (len(steps[k]) // 100 + 1) + 3)
    ws.freeze_panes = "A16"
    ws.sheet_view.showGridLines = False
    ws.print_area = f"A1:E{STEP_LAST}"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True


for ws, r in zip(recipe_sheets, RECIPES):
    build_recipe_sheet(ws, r)
build_recipe_sheet(ws_tpl, None)

# ========================================================== Dish Planner
P = ws_plan
P.sheet_properties.tabColor = C_DARK
P["A1"] = "Dish Planner"
P["A1"].font = f_title
P["A2"] = ("Set each meal's date, eat time and drive time, then type how many batches of each dish go to each meal "
           "(1, 2, 0.5…). The Shopping List and Cook Schedule update from this page.")
P["A2"].font = f_sub
P.merge_cells("A2:J2")
labels = [(4, "Meal / host"), (5, "Date"), (6, "Eat time"), (7, "Drive time (min) — 0 = at our house"), (8, "Food ready by (= leave time if away)")]
for row, lab in labels:
    P.cell(row, 1, lab).font = f_bold
    P.merge_cells(start_row=row, start_column=1, end_row=row, end_column=3)
for k, col in enumerate(MEAL_COLS):
    if k < len(MEALS):
        name, d, t, drive = MEALS[k]
        y, mo, da = map(int, d.split("-"))
        hh, mm = map(int, t.split(":"))
        P[f"{col}4"], P[f"{col}5"], P[f"{col}6"], P[f"{col}7"] = name, date(y, mo, da), time(hh, mm), drive
    for row in (4, 5, 6, 7):
        P[f"{col}{row}"].fill = fill_input
        P[f"{col}{row}"].border = box
        P[f"{col}{row}"].alignment = center
    P[f"{col}4"].font = f_bold
    P[f"{col}5"].number_format = "ddd m/d/yy"
    P[f"{col}6"].number_format = TIME_FMT
    P[f"{col}8"] = f'=IF(OR({col}5="",{col}6=""),"",{col}5+{col}6-N({col}7)/1440)'
    P[f"{col}8"].number_format = "ddd h:mm AM/PM"
    P[f"{col}8"].fill = fill_calc
    P[f"{col}8"].border = box
    P[f"{col}8"].alignment = center
    P[f"{col}8"].font = f_bold
for col, note in (("E5", "Placeholder: you didn't say when our own dinner is. Change it."),
                  ("F7", "Placeholder drive time. Change it."),
                  ("G5", "Placeholder: you didn't give a day for Pam's. Change it.")):
    P[col].comment = Comment(note, "Planner")

P["K4"], P["K5"], P["K6"] = "Settings", "Make-ahead dishes done by", "Advance steps (thaw etc.) at"
P["K4"].font = f_section
P["L5"], P["L6"] = time(19, 0), time(9, 0)
for c in ("L5", "L6"):
    P[c].fill = fill_input; P[c].border = box; P[c].number_format = TIME_FMT
P["K7"] = "Day-before dishes finish by L5 the night before."
P["K7"].font = f_sub

header_row(P, 10, ["Dish (= tab name)", "Lead", "Total batches"] + [None] * N_MEALS + ["Tab found?"])
for k, col in enumerate(MEAL_COLS):
    P[f"{col}10"] = f'=IF({col}4="","",{col}4)'
dish_names = [r["name"] for r in RECIPES]
for k, row in enumerate(range(PLAN_FIRST, PLAN_LAST + 1)):
    if k < len(dish_names):
        dn = dish_names[k]
        P.cell(row, 1, dn)
        P.cell(row, 2, LEADS.get(dn))
        for m, col in enumerate(MEAL_COLS):
            v = PLAN.get(dn, (0,) * len(MEALS))
            if m < len(v) and v[m]:
                P[f"{col}{row}"] = v[m]
    P.cell(row, 3, f'=IF(A{row}="","",SUM({MC0}{row}:{MC1}{row}))')
    P.cell(row, 10, f'=IF(A{row}="","",IF(IFERROR(ISREF(INDIRECT("\'"&A{row}&"\'!A1")),FALSE),"✓","⚠ No tab with this name"))')
    for c in [1, 2] + list(range(4, 4 + N_MEALS)):
        P.cell(row, c).fill = fill_input
        P.cell(row, c).border = box
    for c in (3, 10):
        P.cell(row, c).fill = fill_calc
        P.cell(row, c).border = box
    for c in range(3, 4 + N_MEALS):
        P.cell(row, c).alignment = center
    P.cell(row, 3).font = f_bold
add_list_validation(P, f"B{PLAN_FIRST}:B{PLAN_LAST}", COOK_LIST)
widths(P, {"A": 26, "B": 10, "C": 9, "D": 13, "E": 13, "F": 13, "G": 13, "H": 13, "I": 13, "J": 20, "K": 26, "L": 12})
P.row_dimensions[10].height = 30
P.freeze_panes = "B11"
P.sheet_view.showGridLines = False
P.conditional_formatting.add(f"{MC0}{PLAN_FIRST}:{MC1}{PLAN_LAST}",
                             FormulaRule(formula=[f"N({MC0}{PLAN_FIRST})>0"], fill=PatternFill("solid", fgColor="F4B183"), font=Font(bold=True)))
P.conditional_formatting.add(f"J{PLAN_FIRST}:J{PLAN_LAST}",
                             FormulaRule(formula=[f'LEFT(J{PLAN_FIRST},1)="⚠"'], font=Font(color="C00000", bold=True)))

# ================================================================== Calc
K = ws_calc
K.sheet_state = "hidden"
K["A1"] = "Recipe attributes (from each recipe tab via INDIRECT)"
heads = ["i", "tab", "tab ok", "lead", "batches", "method", "temp", "prep", "cook", "rest", "make ahead", "adv step", "adv days"]
for c, h in enumerate(heads, 1):
    K.cell(1, c, h)
for i in range(1, N_RECIPES + 1):
    r = 1 + i
    pr = PLAN_FIRST + i - 1
    K.cell(r, 1, i)
    K.cell(r, 2, f'=IF(TRIM({PL}!A{pr})="","",TRIM({PL}!A{pr}))')
    K.cell(r, 3, f'=IF(B{r}="",FALSE,IFERROR(ISREF(INDIRECT("\'"&B{r}&"\'!A1")),FALSE))')
    K.cell(r, 4, f'={PL}!B{pr}&""')
    K.cell(r, 5, f'=IF(C{r},N({PL}!C{pr}),0)')
    K.cell(r, 6, f'=IF(C{r},INDIRECT("\'"&B{r}&"\'!C5")&"","")')
    for col, cell in ((7, "C6"), (8, "C7"), (9, "C8"), (10, "C9"), (11, "C10")):
        K.cell(r, col, f'=IF(C{r},N(INDIRECT("\'"&B{r}&"\'!{cell}")),0)')
    K.cell(r, 12, f'=IF(C{r},INDIRECT("\'"&B{r}&"\'!C11")&"","")')
    K.cell(r, 13, f'=IF(C{r},N(INDIRECT("\'"&B{r}&"\'!C12")),0)')

lh = ["i", "j", "tab", "ok", "row", "qty raw", "unit", "ingredient", "qty clean", "space pos", "frac part", "qty",
      "unit eff", "ing row", "buy unit", "factor", "batches", "need", "status", "issue key"]
for c, h in enumerate(lh, 1):
    K.cell(CALC_LINE_FIRST - 1, c, h)
ING_A = f"Ingredients!$A${INGM_FIRST}:$A${INGM_LAST}"
ING_B = f"Ingredients!$B${INGM_FIRST}:$B${INGM_LAST}"
CONV_KEY = f"Conversions!$F${CONV_FIRST}:$F${CONV_LAST}"
CONV_VAL = f"Conversions!$C${CONV_FIRST}:$C${CONV_LAST}"
for i in range(1, N_RECIPES + 1):
    for j in range(1, N_LINES + 1):
        r = CALC_LINE_FIRST + (i - 1) * N_LINES + (j - 1)
        tr = ING_FIRST + j - 1
        K.cell(r, 1, i)
        K.cell(r, 2, j)
        K.cell(r, 3, f"=$B${1 + i}")
        K.cell(r, 4, f"=$C${1 + i}")
        K.cell(r, 5, tr)
        K.cell(r, 6, f'=IF(D{r},TRIM(INDIRECT("\'"&C{r}&"\'!A"&E{r})&""),"")')
        K.cell(r, 7, f'=IF(D{r},TRIM(INDIRECT("\'"&C{r}&"\'!B"&E{r})&""),"")')
        K.cell(r, 8, f'=IF(D{r},TRIM(INDIRECT("\'"&C{r}&"\'!C"&E{r})&""),"")')
        K.cell(r, 9, (f'=TRIM(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE('
                      f'F{r},"⁄","/"),"½"," 1/2"),"¼"," 1/4"),"¾"," 3/4"),"⅓"," 1/3"),"⅔"," 2/3"),"⅛"," 1/8"))'))
        K.cell(r, 10, f'=IFERROR(FIND(" ",I{r}),0)')
        K.cell(r, 11, f'=IF(J{r}>0,MID(I{r},J{r}+1,99),I{r})')
        K.cell(r, 12, (f'=IF(I{r}="",0,IFERROR(IF(ISERROR(FIND("/",K{r})),VALUE(I{r}),'
                       f'IF(J{r}>0,VALUE(LEFT(I{r},J{r}-1)),0)+VALUE(LEFT(K{r},FIND("/",K{r})-1))/VALUE(MID(K{r},FIND("/",K{r})+1,99))),-1))'))
        K.cell(r, 13, f'=IF(G{r}="","each",G{r})')
        K.cell(r, 14, f'=IF(H{r}="",0,IFERROR(MATCH(H{r},{ING_A},0),0))')
        K.cell(r, 15, f'=IF(N{r}=0,"",INDEX({ING_B},N{r}))')
        K.cell(r, 16, (f'=IF(N{r}=0,0,IF(LOWER(M{r})=LOWER(O{r}),1,IFERROR(INDEX({CONV_VAL},MATCH(H{r}&"|"&M{r},{CONV_KEY},0)),'
                       f'IFERROR(IF(AND(VLOOKUP(M{r},{UNIT_TBL},2,FALSE)=VLOOKUP(O{r},{UNIT_TBL},2,FALSE),VLOOKUP(M{r},{UNIT_TBL},2,FALSE)<>"count"),'
                       f'VLOOKUP(M{r},{UNIT_TBL},3,FALSE)/VLOOKUP(O{r},{UNIT_TBL},3,FALSE),-1),-1))))'))
        K.cell(r, 17, f"=$E${1 + i}")
        K.cell(r, 18, f'=IF(OR(L{r}<=0,P{r}<=0),0,L{r}*P{r}*Q{r})')
        K.cell(r, 19, (f'=IF(H{r}="",IF(F{r}="","","⚠ Qty with no ingredient"),IF(N{r}=0,"⚠ Not on Ingredients tab",IF(F{r}="","to taste",'
                       f'IF(L{r}<0,"⚠ Can\'t read qty """&F{r}&"""",IF(P{r}<0,"⚠ No conversion "&M{r}&" → "&O{r},"ok")))))'))
        K.cell(r, 20, f'=IF(LEFT(S{r},1)="⚠",ROW(),"")')

# ============================================================= CalcSched
S = ws_cs
S.sheet_state = "hidden"
sh = ["type", "m", "i", "meal", "batches", "dish", "lead", "method / step", "temp", "prep", "cook", "rest", "make ahead / adv days",
      "meal ready", "valid", "ready", "out", "in", "start", "include", "key", "oven", "load", "temp clash", "oven msg"]
for c, h in enumerate(sh, 1):
    S.cell(1, c, h)
SCHED = q("Cook Schedule")
MF, CF = f"{SCHED}!$C$3", f"{SCHED}!$C$4"
MAIN_RNG = lambda col: f"${col}${SCH_MAIN}:${col}${SCH_ADV - 1}"
for m in range(1, N_MEALS + 1):
    for i in range(1, N_RECIPES + 1):
        r = SCH_MAIN + (m - 1) * N_RECIPES + (i - 1)
        ka = 1 + i  # Calc attribute row
        S.cell(r, 1, "Cook"); S.cell(r, 2, m); S.cell(r, 3, i)
        S.cell(r, 4, f'=INDEX({PL}!${MC0}$4:${MC1}$4,B{r})&""')
        S.cell(r, 6, f"=Calc!$B${ka}")
        S.cell(r, 5, f'=IF(OR(F{r}="",NOT(Calc!$C${ka})),0,N(INDEX({PL}!${MC0}${PLAN_FIRST}:${MC1}${PLAN_LAST},C{r},B{r})))')
        S.cell(r, 7, f"=Calc!$D${ka}")
        S.cell(r, 8, f"=Calc!$F${ka}")
        S.cell(r, 9, f"=Calc!$G${ka}")
        S.cell(r, 10, f"=Calc!$H${ka}")
        S.cell(r, 11, f"=Calc!$I${ka}")
        S.cell(r, 12, f"=Calc!$J${ka}")
        S.cell(r, 13, f"=Calc!$K${ka}")
        S.cell(r, 14, f'=INDEX({PL}!${MC0}$8:${MC1}$8,B{r})')
        S.cell(r, 15, f'=AND(E{r}>0,ISNUMBER(N{r}))')
        S.cell(r, 16, f'=IF(O{r},IF(M{r}>0,INT(N{r})-M{r}+{PL}!$L$5,N{r}),0)')
        S.cell(r, 17, f'=IF(O{r},P{r}-L{r}/1440,0)')
        S.cell(r, 18, f'=IF(O{r},Q{r}-K{r}/1440,0)')
        S.cell(r, 19, f'=IF(O{r},R{r}-J{r}/1440,0)')
        S.cell(r, 20, f'=AND(O{r},OR({MF}="All",{MF}=D{r}),OR({CF}="All",{CF}=G{r}))')
        S.cell(r, 21, f'=IF(T{r},S{r}+ROW()/10000000,"")')
        S.cell(r, 22, f'=IF(AND(O{r},H{r}="Oven",K{r}>0),1,0)')
        S.cell(r, 23, f'=IF(V{r}=1,SUMPRODUCT({MAIN_RNG("V")},{MAIN_RNG("E")},--({MAIN_RNG("R")}<Q{r}),--({MAIN_RNG("Q")}>R{r})),0)')
        S.cell(r, 24, f'=IF(V{r}=1,SUMPRODUCT({MAIN_RNG("V")},--({MAIN_RNG("I")}<>I{r}),--({MAIN_RNG("R")}<Q{r}),--({MAIN_RNG("Q")}>R{r})),0)')
        S.cell(r, 25, f'=IF(V{r}=0,"",IF(X{r}>0,"⚠ Temp clash",IF(W{r}>=3,"⚠ "&W{r}&" dishes in oven","ok")))')
        # advance-step twin row
        a = r + (SCH_ADV - SCH_MAIN)
        S.cell(a, 1, "Advance"); S.cell(a, 2, m); S.cell(a, 3, i)
        for col in "DEFG":
            S[f"{col}{a}"] = f"={col}{r}"
        S.cell(a, 8, f"=Calc!$L${ka}")
        S.cell(a, 13, f"=Calc!$M${ka}")
        S.cell(a, 15, f'=AND(O{r},H{a}<>"")')
        S.cell(a, 19, f'=IF(O{a},INT(R{r})-M{a}+{PL}!$L$6,0)')
        S.cell(a, 20, f'=AND(O{a},OR({MF}="All",{MF}=D{a}),OR({CF}="All",{CF}=G{a}))')
        S.cell(a, 21, f'=IF(T{a},S{a}+ROW()/10000000,"")')
for m in range(1, N_MEALS + 1):
    r = SCH_MEAL + m - 1
    col = MEAL_COLS[m - 1]
    S.cell(r, 1, "Meal"); S.cell(r, 2, m)
    S.cell(r, 4, f'=INDEX({PL}!${MC0}$4:${MC1}$4,B{r})&""')
    S.cell(r, 6, f'=IF(D{r}="","",IF(N({PL}!{col}7)>0,"LEAVE for "&D{r}&" (eat "&TEXT({PL}!{col}6,"h:mm AM/PM")&")","SERVE dinner: "&D{r}))')
    S.cell(r, 14, f'=INDEX({PL}!${MC0}$8:${MC1}$8,B{r})')
    S.cell(r, 15, f'=AND(D{r}<>"",ISNUMBER(N{r}))')
    S.cell(r, 19, f'=IF(O{r},N{r},0)')
    S.cell(r, 20, f'=AND(O{r},OR({MF}="All",{MF}=D{r}))')
    S.cell(r, 21, f'=IF(T{r},S{r}+ROW()/10000000,"")')

# ========================================================= Cook Schedule
W = ws_sched
W.sheet_properties.tabColor = C_DARK
W["A1"] = "Cook Schedule"
W["A1"].font = f_title
W["A2"] = ("Built from the Dish Planner (eat times, drive times, batches, who's cooking) and each recipe's prep, cook and rest times. "
           "Times work backward from 'ready by'. Filter by meal or cook below.")
W["A2"].font = f_sub
W.merge_cells("A2:K2")
W["A3"], W["A4"] = "Show meal", "Show cook"
W["C3"], W["C4"] = "All", "All"
for c in ("A3", "A4"):
    W[c].font = f_bold
for c in ("C3", "C4"):
    W[c].fill = fill_input; W[c].border = box; W[c].font = f_bold
add_list_validation(W, "C3", MEAL_FILTER)
add_list_validation(W, "C4", COOK_FILTER)
W["E3"] = (f'=IF(COUNTIF(CalcSched!$Y${SCH_MAIN}:$Y${SCH_ADV - 1},"⚠*")=0,"Oven check: no clashes",'
           f'"⚠ Oven check: "&COUNTIF(CalcSched!$Y${SCH_MAIN}:$Y${SCH_ADV - 1},"⚠*")&" dish(es) clash. See the last column.")')
W["E3"].font = Font(name=FONT, size=10, bold=True, color="9C2A00")
W["E4"] = "Only one oven. A clash means two dishes overlap at different temps, or 3+ dishes are in at once."
W["E4"].font = f_sub
SH = 6
header_row(W, SH, ["Day", "Start prep", "In oven / on", "Done cooking", "Ready by", "Dish / task", "Batches", "Lead",
                   "Method", "For meal", "Oven check"])
CS = lambda col: f"CalcSched!${col}${SCH_MAIN}:${col}${SCH_LAST}"
for n in range(1, N_SCHED + 1):
    r = SH + n
    W[f"Y{r}"] = f'=IFERROR(SMALL({CS("U")},{n}),"")'
    W[f"Z{r}"] = f'=IF(Y{r}="","",MATCH(Y{r},{CS("U")},0))'
    g = lambda col: f'INDEX({CS(col)},$Z{r})'
    W[f"X{r}"] = f'=IF(Z{r}="","",{g("A")})'
    W[f"A{r}"] = f'=IF(Z{r}="","",INT({g("S")}))'
    W[f"B{r}"] = f'=IF(Z{r}="","",IF(X{r}="Meal","",{g("S")}))'
    W[f"C{r}"] = f'=IF(Z{r}="","",IF(AND(X{r}="Cook",{g("K")}>0),{g("R")},""))'
    W[f"D{r}"] = f'=IF(Z{r}="","",IF(AND(X{r}="Cook",{g("K")}>0),{g("Q")},""))'
    W[f"E{r}"] = f'=IF(Z{r}="","",IF(X{r}="Cook",{g("P")},IF(X{r}="Meal",{g("S")},"")))'
    W[f"F{r}"] = f'=IF(Z{r}="","",IF(X{r}="Advance",{g("F")}&" — "&{g("H")},{g("F")}))'
    W[f"G{r}"] = f'=IF(Z{r}="","",IF(X{r}="Cook",{g("E")},""))'
    W[f"H{r}"] = f'=IF(Z{r}="","",{g("G")}&"")'
    W[f"I{r}"] = f'=IF(Z{r}="","",IF(X{r}="Cook",{g("H")}&IF({g("I")}>0," "&{g("I")}&"°",""),""))'
    W[f"J{r}"] = f'=IF(Z{r}="","",{g("D")})'
    W[f"K{r}"] = f'=IF(Z{r}="","",IF(X{r}="Cook",IF({g("Y")}="ok","",{g("Y")}),""))'
    W[f"A{r}"].number_format = DAY_FMT
    for col in "BCDE":
        W[f"{col}{r}"].number_format = TIME_FMT
    for col in "ABCDEGHIJK":
        W[f"{col}{r}"].alignment = Alignment(horizontal="center")
    for col in "ABCDEFGHIJK":
        W[f"{col}{r}"].border = Border(bottom=Side(style="thin", color="EEE2D6"))
for col in "XYZ":
    W.column_dimensions[col].hidden = True
widths(W, {"A": 11, "B": 11, "C": 12, "D": 12, "E": 11, "F": 50, "G": 8, "H": 9, "I": 15, "J": 11, "K": 24})
W.row_dimensions[SH].height = 30
W.freeze_panes = f"B{SH + 1}"
W.sheet_view.showGridLines = False
rng = f"A{SH + 1}:K{SH + N_SCHED}"
W.conditional_formatting.add(rng, FormulaRule(formula=[f'$X{SH + 1}="Meal"'], fill=PatternFill("solid", fgColor=C_ACCENT), font=Font(bold=True, color="FFFFFF")))
W.conditional_formatting.add(rng, FormulaRule(formula=[f'$X{SH + 1}="Advance"'], font=Font(italic=True, color="1F4E79")))
W.conditional_formatting.add(f"K{SH + 1}:K{SH + N_SCHED}", FormulaRule(formula=[f'LEFT($K{SH + 1},1)="⚠"'], font=Font(bold=True, color="C00000")))
W.conditional_formatting.add(rng, FormulaRule(formula=[f'AND(ISNUMBER($A{SH + 1}),ISODD($A{SH + 1}))'], fill=fill_soft))
W.page_setup.orientation = "landscape"
W.page_setup.fitToWidth = 1
W.page_setup.fitToHeight = 0
W.sheet_properties.pageSetUpPr.fitToPage = True
W.print_title_rows = f"{SH}:{SH}"

# ========================================================= Shopping List
H = ws_shop
H.sheet_properties.tabColor = C_DARK
H["A1"] = "Shopping List"
H["A1"].font = f_title
H["A2"] = ("Totals every ingredient × batches across all meals on the Dish Planner, rounded up to what you buy, grouped by store "
           "then by aisle. Change an item's store on the Ingredients tab.")
H["A2"].font = f_sub
H.merge_cells("A2:H2")
H["A3"], H["A4"] = "Store", "Hide got-it items"
H["C3"], H["C4"] = "All", "No"
for c in ("A3", "A4"):
    H[c].font = f_bold
for c in ("C3", "C4"):
    H[c].fill = fill_input; H[c].border = box; H[c].font = f_bold
add_list_validation(H, "C3", STORE_FILTER)
add_list_validation(H, "C4", YN)
HS = 7
header_row(H, HS, ["Store", "Section", "Item", "Buy", "Unit", "Exact need", "Package note", "Got"])
IL = lambda col: f"Ingredients!${col}${INGM_FIRST}:${col}${INGM_LAST}"
for n in range(1, N_SHOP + 1):
    r = HS + n
    H[f"Y{r}"] = f'=IFERROR(SMALL({IL("L")},{n}),"")'
    H[f"Z{r}"] = f'=IF(Y{r}="","",MATCH(Y{r},{IL("L")},0))'
    g = lambda col: f'INDEX({IL(col)},$Z{r})'
    H[f"A{r}"] = f'=IF(Z{r}="","",{g("K")})'
    H[f"B{r}"] = f'=IF(Z{r}="","",{g("C")})'
    H[f"C{r}"] = f'=IF(Z{r}="","",{g("A")})'
    H[f"D{r}"] = f'=IF(Z{r}="","",{g("J")})'
    H[f"E{r}"] = f'=IF(Z{r}="","",{g("B")})'
    H[f"F{r}"] = f'=IF(Z{r}="","",ROUND({g("I")},2))'
    H[f"G{r}"] = f'=IF(Z{r}="","",{g("G")}&"")'
    H[f"H{r}"] = f'=IF(Z{r}="","",IF({g("M")},"✓",""))'
    H[f"D{r}"].number_format = "0.##"
    H[f"F{r}"].number_format = "0.##"
    H[f"D{r}"].font = f_bold
    for col in "DEFH":
        H[f"{col}{r}"].alignment = Alignment(horizontal="center")
    for col in "ABCDEFGH":
        H[f"{col}{r}"].border = Border(bottom=Side(style="thin", color="EEE2D6"))
for col in "YZ":
    H.column_dimensions[col].hidden = True
rng = f"A{HS + 1}:H{HS + N_SHOP}"
store_fills = {"Price Chopper": "FBE5D6", "Hy-Vee": "E2EFDA", "Costco": "DDEBF7", "Aldi": "FFF2CC", "Pantry check": "EDEDED", "Unassigned": "F8CBAD"}
H.conditional_formatting.add(rng, FormulaRule(formula=[f'$H{HS + 1}="✓"'], font=Font(strike=True, color="A6A6A6")))
for sname, colr in store_fills.items():
    H.conditional_formatting.add(rng, FormulaRule(formula=[f'$A{HS + 1}="{sname}"'], fill=PatternFill("solid", fgColor=colr)))
H.conditional_formatting.add(f"A{HS + 1}:B{HS + N_SHOP}", FormulaRule(formula=[f'A{HS + 1}<>A{HS}'], font=Font(bold=True)))

# summary + needs-attention panel
H["J3"] = "Items by store"
H["J3"].font = f_section
for k, sname in enumerate(STORES + ["Unassigned", "Pantry check"]):
    r = 4 + k
    H[f"J{r}"] = sname
    H[f"K{r}"] = f'=COUNTIFS({IL("K")},J{r},{IL("J")},">0")'
    H[f"K{r}"].alignment = Alignment(horizontal="center")
H["J12"] = "Needs attention"
H["J12"].font = f_section
H["J13"] = (f'=IF(COUNT(Calc!$T${CALC_LINE_FIRST}:$T${CALC_LINE_LAST})=0,"Nothing. Every recipe line totals cleanly.",'
            f'COUNT(Calc!$T${CALC_LINE_FIRST}:$T${CALC_LINE_LAST})&" recipe line(s) can\'t be totaled:")')
H["J13"].font = f_sub
header_row(H, 14, ["Recipe tab", "Ingredient", "Problem"], start_col=10)
CL = lambda col: f"Calc!${col}${CALC_LINE_FIRST}:${col}${CALC_LINE_LAST}"
for n in range(1, 16):
    r = 14 + n
    H[f"X{r}"] = f'=IFERROR(MATCH(SMALL({CL("T")},{n}),{CL("T")},0),"")'
    H[f"J{r}"] = f'=IF(X{r}="","",INDEX({CL("C")},X{r}))'
    H[f"K{r}"] = f'=IF(X{r}="","",INDEX({CL("H")},X{r}))'
    H[f"L{r}"] = f'=IF(X{r}="","",INDEX({CL("S")},X{r}))'
    for col in "JKL":
        H[f"{col}{r}"].font = Font(name=FONT, size=9, color="C00000")
H.column_dimensions["X"].hidden = True
widths(H, {"A": 14, "B": 17, "C": 30, "D": 7, "E": 9, "F": 9, "G": 32, "H": 6, "I": 3, "J": 22, "K": 24, "L": 34})
H.freeze_panes = f"A{HS + 1}"
H.sheet_view.showGridLines = False
H.page_setup.fitToWidth = 1
H.page_setup.fitToHeight = 0
H.sheet_properties.pageSetUpPr.fitToPage = True
H.print_area = f"A1:H{HS + N_SHOP}"
H.print_title_rows = f"{HS}:{HS}"

# ============================================================ Start Here
T = ws_start
T.sheet_properties.tabColor = C_ACCENT
T.sheet_view.showGridLines = False
T.column_dimensions["A"].width = 3
T.column_dimensions["B"].width = 26
T.column_dimensions["C"].width = 90
T["B2"] = "Freeman Thanksgiving Planner"
T["B2"].font = Font(name=FONT, size=22, bold=True, color=C_DARK)
T["B3"] = "Recipes → Dish Planner → Shopping List + Cook Schedule"
T["B3"].font = f_sub
rows = [
    ("HOW IT FLOWS", None),
    ("Dish Planner", "Set each meal (host, date, eat time, drive time) and how many batches of each dish go to it. Everything else reads from here."),
    ("Shopping List", "Builds itself: ingredient × batches across every meal, combined (¾ onion + ½ onion + 1 cup diced onion = 3 onions), rounded up to what you buy, grouped by store then aisle. Pick one store at the top when you're shopping there."),
    ("Cook Schedule", "Works backward from 'ready by' (eat time, or leave time when you're driving) using each recipe's prep, cook and rest times. Day-before dishes land the night before. Flags oven clashes (one oven: different temps overlapping, or 3+ dishes in at once)."),
    ("Recipe tabs", "One per recipe, all the same layout: details, then Qty | Unit | Ingredient | Prep, then numbered steps. Edit anything in yellow."),
    ("Ingredients", "The master list. Each ingredient appears once with its buy unit, store aisle, store, and whether it's a pantry staple. Change a store here and it moves on the shopping list."),
    ("Conversions", "Only for odd units, e.g. 1 cup diced onion = 1 onion, 1 Tbsp butter = ⅛ stick. Volume and weight convert on their own."),
    ("", None),
    ("COLORS", None),
    ("Yellow", "Yours to edit."),
    ("Grey", "Calculated. Leave it alone (overwriting it is fine where a note says so, like turkey cook time)."),
    ("", None),
    ("ADD A RECIPE", None),
    ("1.", "Right-click the _Template tab → Duplicate (Google) or Move or Copy → Create a copy (Excel)."),
    ("2.", "Rename the copy to the dish name, e.g. Deviled Eggs 2. Avoid apostrophes in tab names."),
    ("3.", "Type that exact name into the next empty row of the Dish Planner's Dish column. The 'Tab found?' column turns ✓."),
    ("4.", "Fill in details, ingredients (pick from the dropdown), and steps."),
    ("", None),
    ("ADD AN INGREDIENT", None),
    ("", "If the dropdown doesn't have it, add a row at the bottom of the Ingredients tab first. If its recipe unit is a count that doesn't match the buy unit (e.g. 'clove' vs 'head'), add a Conversions row. The Shopping List's 'Needs attention' box tells you when either is missing."),
    ("", None),
    ("QTY TIPS", None),
    ("", "Type fractions as 1/2 or 1 1/2. The Qty column is text so Google won't turn them into dates (that's what happened to the old Chex Mix tab). For ranges like 2–3, pick one number. Leave Qty blank for 'to taste'."),
    ("", None),
    ("CHECKING OFF", None),
    ("", "Mark 'Got it' on the Ingredients tab (type x, or Insert → Checkbox in Google). The Shopping List shows ✓ and strikes it through; set 'Hide got-it items' to Yes to drop them. The list re-sorts as plans change, so ticks live on the Ingredients tab, not on the list itself."),
]
r = 5
for lab, txt in rows:
    if txt is None:
        T.cell(r, 2, lab).font = f_section
    else:
        T.cell(r, 2, lab).font = f_bold
        c = T.cell(r, 3, txt)
        c.font = f_base
        c.alignment = wrap_top
        T.cell(r, 2).alignment = Alignment(vertical="top")
        T.row_dimensions[r].height = max(15, 14 * (len(txt) // 105 + 1))
    r += 1
T["B6"].fill = T["B7"].fill = T["B8"].fill = fill_soft
T["B14"].fill = fill_input
T["B15"].fill = fill_calc

# ---------------------------------------------------------- fonts & save
for ws in wb.worksheets:
    for row in ws.iter_rows():
        for c in row:
            fnt = c.font
            if fnt.name != FONT:
                c.font = Font(name=FONT, size=fnt.size or 10, bold=fnt.bold, italic=fnt.italic,
                              color=fnt.color, strike=fnt.strike)

wb.save(OUT)
print("saved", OUT)
