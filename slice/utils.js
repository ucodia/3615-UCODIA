import axios from "axios";
import { parse, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const BASE_URL =
  "https://cdn5.editmysite.com/app/store/api/v28/editor/users/137962747/sites/821974950840857745/products";
const WORKSHOP_URL = `${BASE_URL}?per_page=200&categories[]=IPSBNDZZVKKKFGAXTKHXENOG`;
const EXHIBITS_URL = `${BASE_URL}?per_page=200&categories[]=MMDIM4KVPD4DWPWJFHWGKFDA`;

const CACHE_TTL_MS = 60 * 60 * 1000;
const urlCache = new Map();

async function getEvents(URL) {
  const cached = urlCache.get(URL);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    console.log("Events cache hit:", URL);
    return cached.events;
  }
  try {
    const response = await axios.get(URL);
    const products = response.data.data;
    const now = new Date();

    const events = products
      // filter non-events
      .filter((product) => product.product_type_details?.start_date)
      .map((product) => {
        // sample event details
        // "name": "JANUARY 1 - OPENING NIGHT with @xyz",
        // "product_type_details": {
        //   "start_date": "2026-02-17",
        //   "start_time": "7:00 PM",
        //   "timezone": "America/Los_Angeles",
        // }

        const details = product.product_type_details;
        const dateTimeString = `${details.start_date} ${details.start_time}`;
        const date = parse(dateTimeString, "yyyy-MM-dd hh:mm aaa", new Date());
        const zonedDate = toZonedTime(date, details.timezone);

        return {
          name: product.name.split(" - ")[1]?.trim(),
          date: zonedDate,
          displayDate: format(zonedDate, "EEE, MMMM do, h:mm a"),
          description: product.short_description,
          link: product.absolute_site_link,
          price: product.price.low,
          quantity: product.inventory.lowest,
          rawTitle: product.name,
        };
      })
      // filter events more than 1 week past
      .filter(
        (event) =>
          event.date >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      )
      // sort by date ascending
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    urlCache.set(URL, { events, fetchedAt: Date.now() });
    console.log("Events cache set:", URL);
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
