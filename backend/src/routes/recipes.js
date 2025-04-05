// ✅ recipes.js
console.log("✅ recipes.js loaded");
const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// GET /recipes - return all saved recipes with optional pagination and ingredient search
router.get("/", async (req, res) => {
  const { page = 1, limit = 10, ingredients, random = false } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let whereClause = "";
    let values = [parseInt(limit), offset];

    if (ingredients) {
      whereClause = "WHERE LOWER(ingredients) LIKE LOWER($3)";
      values = [parseInt(limit), offset, `%${ingredients}%`];
    }

    const countQuery = ingredients ?
      "SELECT COUNT(*) FROM recipes WHERE LOWER(ingredients) LIKE LOWER($1)" :
      "SELECT COUNT(*) FROM recipes";
    const countValues = ingredients ? [`%${ingredients}%`] : [];
    const countResult = await db.query(countQuery, countValues);
    const totalCount = parseInt(countResult.rows[0].count);

    const result = await db.query(
      `SELECT * FROM recipes ${whereClause} ORDER BY ${random === "true" ? "RANDOM()" : "id ASC"} LIMIT $1 OFFSET $2`,
      values
    );

    res.json({
      data: result.rows,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (err) {
    console.error("Error fetching recipes:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /recipes/random - shortcut to return a single random saved recipe
router.get("/random", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM recipes ORDER BY RANDOM() LIMIT 1");
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No recipes found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching random recipe:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /user/preferences - save or update user preferences (mocked, no auth)
router.post("/user/preferences", async (req, res) => {
  const { userId, preferences } = req.body;

  if (!userId || !preferences) {
    return res.status(400).json({ error: "User ID and preferences are required." });
  }

  try {
    await db.query(
      `INSERT INTO user_preferences (user_id, preferences)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET preferences = EXCLUDED.preferences`,
      [userId, preferences]
    );
    res.status(200).json({ message: "Preferences saved." });
  } catch (err) {
    console.error("Error saving preferences:", err);
    res.status(500).json({ error: "Failed to save preferences" });
  }
});

// GET /recipes/generate - generate a new recipe with flexible filters
router.get("/generate", async (req, res) => {
  const {
    title,
    ingredients,
    minProtein,
    maxProtein,
    minCalories,
    maxCalories,
    minCarbs,
    maxCarbs,
    minFat,
    maxFat,
    dietaryRestrictions
  } = req.query;

  if (
    !title && !ingredients &&
    !minProtein && !maxProtein &&
    !minCalories && !maxCalories &&
    !minCarbs && !maxCarbs &&
    !minFat && !maxFat &&
    !dietaryRestrictions
  ) {
    return res.status(400).json({ error: "At least one filter must be provided." });
  }

  let prompt = `Generate a realistic, unique recipe`;
  if (title) prompt += ` using or inspired by \"${title}\"`;
  if (ingredients) prompt += ` that includes ingredients such as: ${ingredients}`;
  prompt += ` that meets these nutritional guidelines:\n`;

  if (minProtein) prompt += `- At least ${minProtein}g protein\n`;
  if (maxProtein) prompt += `- No more than ${maxProtein}g protein\n`;
  if (minCalories) prompt += `- At least ${minCalories} calories\n`;
  if (maxCalories) prompt += `- No more than ${maxCalories} calories\n`;
  if (minCarbs) prompt += `- At least ${minCarbs}g carbs\n`;
  if (maxCarbs) prompt += `- No more than ${maxCarbs}g carbs\n`;
  if (minFat) prompt += `- At least ${minFat}g fat\n`;
  if (maxFat) prompt += `- No more than ${maxFat}g fat\n`;

  if (dietaryRestrictions) {
    prompt += `\nThis recipe must be suitable for the following dietary restrictions: ${dietaryRestrictions}`;
  }

  prompt += `\nReturn only a JSON object with the following fields:\n- title\n- ingredients (comma separated)\n- instructions\n- calories\n- protein\n- carbs\n- fat\n`;

  console.log("🧠 Prompt to OpenAI:\n", prompt);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    });

    const responseText = completion.choices[0].message.content;
    const recipe = JSON.parse(responseText);

    await db.query(
      `INSERT INTO recipes (title, ingredients, instructions, calories, protein, carbs, fat)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        recipe.title,
        recipe.ingredients,
        recipe.instructions,
        recipe.calories,
        recipe.protein,
        recipe.carbs,
        recipe.fat
      ]
    );

    res.status(201).json(recipe);
  } catch (err) {
    console.error("❌ Error generating recipe:", err);
    res.status(500).json({ error: "Failed to generate recipe" });
  }
});

// GET /recipes/:id - return a single recipe by ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query("SELECT * FROM recipes WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Recipe not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching recipe:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
