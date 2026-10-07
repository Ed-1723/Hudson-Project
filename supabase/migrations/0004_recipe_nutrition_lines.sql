-- Recipe nutrition was being estimated as one blended total per recipe,
-- with no record of what the model actually did with each ingredient --
-- so a silently dropped or misread line (uppercase units, "(1-can)"
-- parentheticals, fractions like "1/4 Cup") just quietly undercounted the
-- total with no way to tell which ingredient caused it.
--
-- nutrition_lines stores the per-ingredient breakdown the lookup produced
-- (whole-recipe quantities, not per-serving), including any line it
-- couldn't confidently estimate -- so that's visible instead of hidden
-- inside an aggregate number.

alter table recipes
  add column nutrition_lines jsonb;
