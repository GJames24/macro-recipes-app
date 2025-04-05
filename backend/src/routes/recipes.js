console.log("✅ recipes.js loaded");
const express = require("express");
const router = express.Router();
const db = require("../config/db");

// GET /recipes
router.get("/", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM recipes ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching recipes:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /recipes
router.post("/", async (req, res) => {
  const { title, ingredients, instructions, calories, protein, carbs, fat } = req.body;
  console.log("Received recipe:", req.body);

  if (!title || !ingredients || !instructions) {
    return res.status(400).json({ error: "Title, ingredients, and instructions are required." });
  }

  try {
    const result = await db.query(
      `INSERT INTO recipes (title, ingredients, instructions, calories, protein, carbs, fat)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [title, ingredients, instructions, calories, protein, carbs, fat]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error inserting recipe:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /recipes/:id
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  console.log("Fetching recipe with ID:", id);

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

// PUT /recipes/:id
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { title, ingredients, instructions, calories, protein, carbs, fat } = req.body;

  try {
    const result = await db.query(
      `UPDATE recipes SET 
        title = $1,
        ingredients = $2,
        instructions = $3,
        calories = $4,
        protein = $5,
        carbs = $6,
        fat = $7
       WHERE id = $8
       RETURNING *`,
      [title, ingredients, instructions, calories, protein, carbs, fat, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating recipe:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /recipes/:id
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query("DELETE FROM recipes WHERE id = $1 RETURNING *", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    res.json({ message: "Recipe deleted" });
  } catch (err) {
    console.error("Error deleting recipe:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const { OpenAI } = require("openai"); // Add this at the top with your other requires

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// POST /recipes/generate
router.post("/generate", async (req, res) => {
    const { calories, protein, carbs, fat } = req.body;
  
    // 🧼 Basic validation
    if (
      !calories || !protein || !carbs || !fat ||
      isNaN(calories) || isNaN(protein) || isNaN(carbs) || isNaN(fat)
    ) {
      return res.status(400).json({ error: "All macros must be provided as numbers." });
    }
  
    const prompt = `
    Generate a realistic recipe that meets these macros:
    - Calories: ${calories}
    - Protein: ${protein}g
    - Carbs: ${carbs}g
    - Fat: ${fat}g
  
    Return only a JSON object with the following fields:
    - title
    - ingredients (comma separated)
    - instructions
    - calories
    - protein
    - carbs
    - fat
    `;
  
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      });
  
      const responseText = completion.choices[0].message.content;
      const recipe = JSON.parse(responseText);

      // 🔍 Check for duplicate title (or title + instructions)
    const existing = await db.query(
        `SELECT * FROM recipes WHERE title = $1 AND instructions = $2`,
        [recipe.title, recipe.instructions]
      );
  
      if (existing.rows.length > 0) {
        console.log("⚠️ Recipe already exists, skipping insert.");
        return res.status(200).json(recipe);
      }
  
      // 💾 Save to database
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
  
      // 🚀 Return to client
      res.status(201).json(recipe);
    } catch (err) {
      console.error("❌ OpenAI error:", err);
      res.status(500).json({ error: "Failed to generate recipe" });
    }
  });
  

module.exports = router;
