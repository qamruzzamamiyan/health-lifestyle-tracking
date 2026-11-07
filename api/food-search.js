// Vercel Serverless Function: GET /api/food-search?q=banana
// Set USDA_API_KEY in your local .env.local and Vercel Environment Variables.
// Do not put the API key in VITE_* variables or commit it to Git.

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Only GET requests are allowed." });
  }

  const query = typeof req.query?.q === "string" ? req.query.q.trim() : "";
  if (query.length < 2 || query.length > 100) {
    return res.status(400).json({ error: "Food name must be 2–100 characters." });
  }

  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "USDA API key is not configured." });
  }

  try {
    const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
    url.searchParams.set("api_key", apiKey);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        pageSize: 20,
        dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"]
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      return res.status(response.status === 429 ? 429 : 502).json({
        error: response.status === 429
          ? "USDA request limit reached. Please try later."
          : "USDA food search is temporarily unavailable.",
      });
    }

    const data = await response.json();
    const matches = (Array.isArray(data.foods) ? data.foods : []).map((food) => {
      const nutrients = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
      const nutrientValue = (id) => {
        const nutrient = nutrients.find((n) => Number(n.nutrientId) === id);
        return typeof nutrient?.value === "number" ? nutrient.value : null;
      };

      return {
        fdcId: food.fdcId,
        name: food.description,
        dataType: food.dataType,
        brand: food.brandOwner || null,
        reportedNutrients: {
          // Foundation foods often use Atwater energy (2047 or 2048).
          energyKcal: nutrientValue(1008) ?? nutrientValue(2048) ?? nutrientValue(2047),
          proteinG: nutrientValue(1003),
          carbsG: nutrientValue(1005),
          fatG: nutrientValue(1004),
        },
      };
    });

    return res.status(200).json({
      query,
      totalHits: data.totalHits ?? matches.length,
      matches,
    });
  } catch {
    return res.status(502).json({ error: "Could not reach USDA." });
  }
}
