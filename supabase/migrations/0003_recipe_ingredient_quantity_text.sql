-- recipe_ingredients.quantity was numeric, which can't hold how people
-- actually write ingredient amounts ("1/3 cup", "a pinch") and made typing
-- a decimal like "15.5" fight the input (each keystroke got parsed back to
-- a canonical number, stripping the trailing "." the user just typed, and
-- any non-numeric text like a fraction became NaN that re-triggered on
-- every subsequent edit). Nothing in the app does math with this value --
-- it's only ever displayed or joined into text for the nutrition lookup --
-- so it belongs as free text.

alter table recipe_ingredients
  alter column quantity type text using quantity::text;
