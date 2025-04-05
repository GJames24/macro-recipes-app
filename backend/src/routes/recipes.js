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

  console.log("Received recipe:", req.body); // For debugging

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


module.exports = router;
