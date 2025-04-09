document.addEventListener("DOMContentLoaded", () => {
    const promptForm = document.getElementById("promptForm");
    const promptBtn = document.getElementById("promptModeBtn");
    const recipeOutput = document.getElementById("recipeOutput");
    const errorMessage = document.getElementById("errorMessage");
    const loadingMessage = document.getElementById("loadingMessage");
    const generateBtns = document.querySelectorAll("button[type='submit']");
    const historyList = document.getElementById("historyList");
    const favoritesList = document.getElementById("favoritesList");
    const viewFavoritesBtn = document.getElementById("viewFavoritesBtn");
  
    let recipeHistory = JSON.parse(localStorage.getItem("recipeHistory")) || [];
    renderHistory();
  
    promptBtn?.classList.add("active");
    document.getElementById("structuredForm")?.classList.add("hidden");
    document.getElementById("promptForm")?.classList.remove("hidden");
  
    let lastGeneratedRecipe = null;
  
    promptForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMessages();
      toggleLoading(true);
  
      const prompt = document.getElementById("promptText")?.value || "";
  
      try {
        const response = await fetch("http://localhost:5050/recipes/generate/prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt })
        });
  
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "An error occurred");
        }
        const data = await response.json();
        lastGeneratedRecipe = data;
        displayRecipe(data);
        saveToHistory(data);
      } catch (err) {
        showError(err.message);
      } finally {
        toggleLoading(false);
      }
    });
  
    function toggleLoading(isLoading) {
      loadingMessage.classList.toggle("hidden", !isLoading);
      generateBtns.forEach(btn => btn.disabled = isLoading);
    }
  
    function showError(message) {
      errorMessage.textContent = message;
      errorMessage.classList.remove("hidden");
      errorMessage.scrollIntoView({ behavior: "smooth" });
    }
  
    function clearMessages() {
      errorMessage.classList.add("hidden");
      recipeOutput.classList.add("hidden");
      loadingMessage.classList.add("hidden");
    }
  
    function displayRecipe(recipe) {
      const ingredientsList = recipe.ingredients.split(",").map(ing => `<li>${ing.trim()}</li>`).join("");
      const instructionsList = recipe.instructions
        .split(/\n+/)
        .filter(step => step.trim() && !/^\d+$/.test(step.trim()))
        .map(step => `<li>${step.trim().replace(/^\d+\.\s*/, "")}</li>`)
        .join("");
  
      recipeOutput.innerHTML = `
        <div class="recipe-card">
          <h2>${recipe.title}</h2>
          <strong>Ingredients:</strong><ul>${ingredientsList}</ul>
          <strong>Instructions:</strong><ol>${instructionsList}</ol>
          <ul>
            <li><strong>Calories:</strong> ${recipe.calories}</li>
            <li><strong>Protein:</strong> ${recipe.protein}g</li>
            <li><strong>Carbs:</strong> ${recipe.carbs}g</li>
            <li><strong>Fat:</strong> ${recipe.fat}g</li>
          </ul>
          <button class="save-btn" id="saveToFavoritesBtn">Save to Favorites</button>
          <button class="shop-btn" id="shopIngredientsBtn">🛒 Shop Ingredients</button>
        </div>
      `;
      recipeOutput.classList.remove("hidden");
  
      document.getElementById("saveToFavoritesBtn")?.addEventListener("click", () => {
        if (lastGeneratedRecipe && lastGeneratedRecipe.id) {
          checkDuplicateAndSave(lastGeneratedRecipe);
        } else {
          showError("⚠️ Recipe could not be saved. Please try again after generating a valid recipe.");
        }
      });
  
      document.getElementById("shopIngredientsBtn")?.addEventListener("click", () => {
        const servings = prompt("How many servings do you want to shop for?");
        if (!servings || isNaN(servings) || servings <= 0) {
          alert("Please enter a valid number of servings.");
          return;
        }
  
        const ingredients = recipe.ingredients.split(",");
        const searchLinks = ingredients.map(ingredient => {
          const query = encodeURIComponent(`${servings} servings of ${ingredient.trim()}`);
          return `https://www.amazon.com/s?k=${query}`;
        });
  
        const newTab = window.open();
        newTab.document.write("<h1>Shopping Links</h1><ul>");
        searchLinks.forEach(link => {
          newTab.document.write(`<li><a href='${link}' target='_blank'>${decodeURIComponent(link)}</a></li>`);
        });
        newTab.document.write("</ul>");
      });
    }
  
    async function checkDuplicateAndSave(recipe) {
      try {
        const checkRes = await fetch(`http://localhost:5050/recipes/favorites/check/${recipe.id}`);
        if (checkRes.status === 404) {
          await saveToFavorites(recipe);
          return;
        }
        const exists = await checkRes.json();
  
        const confirmReplace = confirm("This recipe is already in your favorites. Replace it?");
        if (!confirmReplace) return;
        await removeFavorite(recipe.id);
        await saveToFavorites(recipe);
      } catch (err) {
        showError("Error checking for duplicate: " + err.message);
      }
    }
  
    async function saveToFavorites(recipe) {
      try {
        const response = await fetch("http://localhost:5050/recipes/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipeId: recipe.id })
        });
  
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to save favorite");
        }
        alert("Recipe saved to favorites!");
      } catch (err) {
        showError("Error: " + err.message);
      }
    }
  
    async function removeFavorite(id) {
      try {
        const response = await fetch(`http://localhost:5050/recipes/favorites/${id}`, {
          method: "DELETE"
        });
        if (!response.ok) throw new Error("Failed to remove favorite");
      } catch (err) {
        showError("Error: " + err.message);
      }
    }
  
    if (viewFavoritesBtn) {
      viewFavoritesBtn.addEventListener("click", async () => {
        try {
          const response = await fetch("http://localhost:5050/recipes/favorites");
          if (!response.ok) throw new Error("Failed to fetch favorites");
          const favorites = await response.json();
          renderFavorites(favorites);
        } catch (err) {
          showError("Error: " + err.message);
        }
      });
    }
  
    function renderFavorites(favorites) {
      favoritesList.innerHTML = "";
      favorites.forEach(fav => {
        const li = document.createElement("li");
        li.textContent = fav.title;
        li.addEventListener("click", () => displayRecipe(fav));
  
        const removeBtn = document.createElement("button");
        removeBtn.textContent = "❌";
        removeBtn.style.marginLeft = "8px";
        removeBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          await removeFavorite(fav.id);
          li.remove();
        });
  
        li.appendChild(removeBtn);
        favoritesList.appendChild(li);
      });
    }
  
    function saveToHistory(recipe) {
      recipeHistory.unshift(recipe);
      if (recipeHistory.length > 5) recipeHistory.pop();
      localStorage.setItem("recipeHistory", JSON.stringify(recipeHistory));
      renderHistory();
    }
  
    function renderHistory() {
      if (!historyList) return;
      historyList.innerHTML = "";
      recipeHistory.forEach((r, i) => {
        const li = document.createElement("li");
        li.textContent = `${r.title} (Protein: ${r.protein}g)`;
        li.addEventListener("click", () => displayRecipe(r));
        historyList.appendChild(li);
      });
    }
  });
  