# Thanksgiving Planner

A spreadsheet version of the Thanksgiving meal planner, built to get through
this year before it moves into Hudson as the meals/groceries module.

- `Freeman_Thanksgiving_Planner.xlsx` is the workbook. Upload it to Google
  Drive and open it with Google Sheets, or use it in Excel.
- `recipes_seed.py` holds the recipes, ingredient master list, conversions
  and the meal plan as plain data. It maps directly onto Hudson's `recipes`
  and `recipe_ingredients` tables, so it's the import source later.
- `build_planner.py` regenerates the workbook from the seed data:
  `python3 thanksgiving/build_planner.py`. Regenerating overwrites edits made
  in the workbook itself, so once you start editing in Sheets, the Sheet
  becomes the source of truth.

## How the workbook fits together

| Tab | Role |
|---|---|
| Dish Planner | Meals (host, date, eat time, drive time) × dishes = batches. The dish list is also the recipe index. |
| Recipe tabs | One per recipe, all the same fixed layout (details C4:C13, ingredients A16:E45, steps A48:E72). |
| Ingredients | Master list: buy unit, store section, store, pantry flag, extras, got-it. |
| Conversions | Odd unit conversions (cups of onion → onions, Tbsp butter → sticks). |
| Shopping List | Sorted by store then section, with a store filter. |
| Cook Schedule | Works backward from ready/leave time, with an oven clash check. |
| Calc, CalcSched | Hidden formula engines (INDIRECT into each recipe tab). |
