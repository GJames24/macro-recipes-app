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

module.exports = router;
