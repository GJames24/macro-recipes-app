const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST /recipes/generate/prompt
router.post("/generate/prompt", async (req, res) => {
  const { prompt, servings } = req.body;

  if (!prompt || prompt.trim() === "") {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const extractionPrompt = `Extract numeric nutrition constraints from the following user prompt. 
Return only a valid JSON with optional keys: protein, carbs, fat, calories. 
Prompt: ${prompt}`;

  try {
    const extractionResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You extract macro and calorie constraints from user requests. Return only JSON: { "protein": number, "carbs": number, "fat": number, "calories": number }`
        },
        { role: "user", content: extractionPrompt }
      ],
      temperature: 0.3,
    });

    const extractedText = extractionResponse.choices[0].message.content.trim();
    let extracted;
    try {
      extracted = JSON.parse(extractedText);
    } catch (err) {
      console.error("Failed to parse extracted macros:", extractedText);
      extracted = {};
    }

    const minProtein = extracted.protein || 0;
    const minCarbs = extracted.carbs || 0;
    const minFat = extracted.fat || 0;
    const maxCalories = extracted.calories || 0;

    const estimatedMinCalories = minProtein * 4 + minCarbs * 4 + minFat * 9;

    if (maxCalories > 0 && estimatedMinCalories > maxCalories) {
      return res.status(400).json({
        error: `❌ Your request is too strict. A recipe with ${minProtein}g protein, ${minCarbs}g carbs, and ${minFat}g fat needs at least ${estimatedMinCalories} calories.`
      });
    }

    const systemPrompt = `
You are a nutrition and recipe assistant. Return only a valid JSON object with the following keys:
- title
- ingredients (comma-separated string with specific quantities, e.g., "200g chicken breast, 1 cup spinach, 1 tbsp olive oil")
- instructions
- calories (number)
- protein (number)
- carbs (number)
- fat (number)

Do not include any explanation or commentary. Do not wrap the JSON in markdown or text. Just output raw JSON.`;

    const generationResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
    });

    const responseText = generationResponse.choices[0].message.content.trim();
    console.log("OpenAI response:", responseText);

    let recipe;
    try {
      recipe = JSON.parse(responseText);
    } catch (err) {
      console.error("❌ Failed to parse JSON. Raw response:", responseText);
      return res.status(500).json({
        error: "OpenAI did not return a valid recipe. Please try a different prompt or adjust your input."
      });
    }

    const calculatedCalories = recipe.protein * 4 + recipe.carbs * 4 + recipe.fat * 9;

    if (maxCalories > 0 && recipe.calories < calculatedCalories) {
      return res.status(400).json({
        error: `❌ The reported calories (${recipe.calories}) are too low for the provided macros. A recipe with ${recipe.protein}g protein, ${recipe.carbs}g carbs, and ${recipe.fat}g fat must have at least ${calculatedCalories} calories.`
      });
    }

    const result = await db.query(
      `INSERT INTO recipes (title, ingredients, instructions, calories, protein, carbs, fat)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
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

    const structuredIngredients = recipe.ingredients.split(",").map(ingredient => {
      return `${servings || 1} x ${ingredient.trim()}`;
    });

    const amazonQuery = encodeURIComponent(
      recipe.ingredients.split(",").map(ing => ing.trim()).join(" ")
    );
    const amazonCartURL = `https://www.amazon.com/s?k=${amazonQuery}&i=amazonfresh`;

    res.status(201).json({
      ...recipe,
      id: result.rows[0].id,
      structuredIngredients,
      amazonCartURL
    });
  } catch (err) {
    console.error("❌ OpenAI error or JSON parse issue:", err);
    res.status(500).json({ error: "Failed to generate recipe" });
  }
});

// POST /recipes/favorites
router.post("/favorites", async (req, res) => {
  const { recipeId } = req.body;
  if (!recipeId) return res.status(400).json({ error: "Recipe ID required" });

  try {
    const exists = await db.query("SELECT * FROM recipes WHERE id = $1", [recipeId]);
    if (exists.rows.length === 0) {
      return res.status(400).json({ error: "Invalid recipe ID" });
    }

    await db.query(
      `INSERT INTO favorites (recipe_id) VALUES ($1) RETURNING *`,
      [recipeId]
    );
    res.status(201).json({ message: "Favorite added" });
  } catch (err) {
    console.error("Failed to save favorite:", err);
    res.status(500).json({ error: "Failed to save favorite" });
  }
});

// GET /recipes/favorites
router.get("/favorites", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.* FROM favorites f JOIN recipes r ON f.recipe_id = r.id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Failed to fetch favorites:", err);
    res.status(500).json({ error: "Failed to fetch favorites" });
  }
});

// DELETE /recipes/favorites/:id
router.delete("/favorites/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(`DELETE FROM favorites WHERE recipe_id = $1`, [id]);
    res.json({ message: "Favorite removed" });
  } catch (err) {
    console.error("Failed to remove favorite:", err);
    res.status(500).json({ error: "Failed to remove favorite" });
  }
});

// GET /recipes/favorites/check/:id
router.get("/favorites/check/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query("SELECT * FROM favorites WHERE recipe_id = $1", [id]);
    res.json({ isFavorite: result.rows.length > 0 });
  } catch (err) {
    console.error("Error checking favorite:", err);
    res.status(500).json({ error: "Failed to check favorite" });
  }
});

module.exports = router;
