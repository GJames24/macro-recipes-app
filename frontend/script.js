document.getElementById("generateForm").addEventListener("submit", async (e) => {
    e.preventDefault();
  
    const form = new FormData(e.target);
  
    const params = new URLSearchParams({
      title: form.get("title"),
      calories: form.get("calories"),
      protein: form.get("protein"),
      carbs: form.get("carbs"),
      fat: form.get("fat"),
      ingredients: form.get("ingredients"),
      dietaryRestrictions: form.get("diet")
    });
  
    document.getElementById("result").textContent = "Loading...";
  
    try {
      const res = await fetch(`http://localhost:5050/recipes/generate?${params}`);
      const data = await res.json();
  
      if (!res.ok) throw new Error(data.error || "Something went wrong");
  
      document.getElementById("result").textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      document.getElementById("result").textContent = err.message;
    }
  });
  