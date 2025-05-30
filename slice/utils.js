import axios from "axios";

const BASE_URL =
  "https://cdn5.editmysite.com/app/store/api/v28/editor/users/137962747/sites/821974950840857745/products";
const WORKSHOP_URL = `${BASE_URL}?per_page=200&categories[]=IPSBNDZZVKKKFGAXTKHXENOG`;
const EXHIBITS_URL = `${BASE_URL}?per_page=200&categories[]=MMDIM4KVPD4DWPWJFHWGKFDA`;

function extractDateFromTitle(title) {
  const months = {
    january: 1,
    jan: 1,
    february: 2,
    feb: 2,
    march: 3,
    mar: 3,
    april: 4,
    apr: 4,
    may: 5,
    june: 6,
    jun: 6,
    july: 7,
    jul: 7,
    august: 8,
    aug: 8,
    september: 9,
    sep: 9,
    october: 10,
    oct: 10,
    november: 11,
    nov: 11,
    december: 12,
    dec: 12,
  };

  // First try to find a year in the title
  const yearMatch = title.match(/20\d{2}/);
  const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

  // Try to match "MONTH DAY" format
  const monthDayMatch = title.match(/([A-Za-z]+)\s+(\d{1,2})/i);
  if (monthDayMatch) {
    const month = months[monthDayMatch[1].toLowerCase()];
    const day = parseInt(monthDayMatch[2]);
    if (month && day) {
      return { year, month, day };
    }
  }

  return null;
}

function extractNameFromTitle(title) {
  // Remove date patterns from the title
  let name = title
    // Remove "MONTH DAY" pattern
    .replace(/[A-Za-z]+\s+\d{1,2}\s+-\s+/, "")
    // Clean up any remaining dashes at the start
    .replace(/^\s*-\s*/, "");

  return name.trim();
}

async function getEvents(URL) {
  try {
    const response = await axios.get(URL);
    const products = response.data.data;
    const now = new Date();

    const events = products
      .map((product) => {
        const date = extractDateFromTitle(product.name);
        if (!date) return null;

        return {
          name: extractNameFromTitle(product.name),
          date: `${date.year}-${String(date.month).padStart(2, "0")}-${String(
            date.day
          ).padStart(2, "0")}`,
          description: product.short_description,
          link: product.absolute_site_link,
          price: product.price.low,
          quantity: product.inventory.lowest,
          rawTitle: product.name,
        };
      })
      .filter((event) => event !== null)
      .filter((event) => new Date(event.date) >= now)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    return events;
  } catch (error) {
    console.error("Error fetching or processing events:", error.message);
    throw error;
  }
}

export async function getWorkshops() {
  return await getEvents(WORKSHOP_URL);
}

export async function getExhibits() {
  return await getEvents(EXHIBITS_URL);
}
