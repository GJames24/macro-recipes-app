require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./config/db");
const recipesRoutes = require("./routes/recipes");

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

// 👇 Route mount
app.use("/recipes", recipesRoutes);

app.get("/", (req, res) => {
  console.log("✅ GET / route hit");
  res.send("Backend is working! 🎉");
});


// TEMP: Direct POST route for testing
app.post("/recipes", (req, res) => {
  console.log("✅ POST /recipes route hit");
  console.log("Request body:", req.body);
  res.status(201).json({ message: "It worked!" });
});



app.listen(PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});
