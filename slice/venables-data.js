export const MAP_URL = "https://maps.app.goo.gl/yg9k32N6Fge48N1N7";

export const CANVAS_ROWS = 11;
export const PAGE_COLS = 40;

export const SLICE_NAME = "Slice of Life";

export const pages = [
  {
    streets: [
      { name: "WOODLAND", col: 6, side: "both" },
      { name: "COTTON", col: 36, side: "S" },
    ],
    labelCol: 21,
    businesses: [
      { name: "Deadly Couture", note: "Goth & alt fashion", side: "N", col: 2, tier: 0 },
      { name: "Vancouver Hack Space", note: "Makerspace", side: "N", col: 12, tier: 0 },
      { name: "Art Works Gallery", note: "High end art", side: "S", col: 16, tier: 0 },
      { name: "The Front Supply Co", note: "24h snacks, gear", side: "N", col: 29, tier: 0 },
      { name: "By Design Modern", note: "Modern furniture", side: "S", col: 32, tier: 0 },
      { name: "Alt Creations Studio", note: "Pop up gallery", side: "N", col: 37, tier: 0 },
    ],
  },
  {
    streets: [
      { name: "COTTON", col: 1, side: "S" },
      { name: "COMMERCIAL", col: 19, side: "N", label: false },
      { name: "COMMERCIAL", col: 36, side: "both" },
    ],
    labelCol: 24,
    businesses: [
      { name: "East Van Brewing", note: "Brewery & arcade", side: "N", col: 8, tier: 0 },
      { name: "Uprising Breads", note: "Coffee and treats", side: "N", col: 14, tier: 0 },
      { name: "Raven's Veil", note: "Our witchy sisters", side: "N", col: 17, tier: 2 },
      { name: SLICE_NAME, note: "Home base since 2015", side: "S", col: 20, tier: 0 },
      { name: "Alterior", note: "Amazing sewing & clothing", side: "N", col: 23, tier: 0 },
      { name: "Vennie's Sub Shop", note: "Meatloaf sandwich!", side: "S", col: 29, tier: 0 },
      { name: "The Bunny Cafe", note: "Kids loveee it", side: "S", col: 32, tier: 0 },
    ],
  },
  {
    streets: [
      { name: "COMMERCIAL", col: 10, side: "both" },
      { name: "", col: 24, side: "S" },
      { name: "SALSBURY", col: 35, side: "both" },
    ],
    labelCol: 13,
    businesses: [
      { name: "VanCity Pinball", note: "Arch nemesis arcade", side: "N", col: 1, tier: 0 },
      { name: "FUN HAUS", note: "Vintage toys & clothes", side: "N", col: 4, tier: 0 },
      { name: "Liquid Amber Tattoo", note: "Tattoos & art", side: "S", col: 14, tier: 0 },
      { name: "Ollie's Vintage", note: "Vintage store", side: "N", col: 16, tier: 0 },
      { name: "Era Design", note: "Jewelry store", side: "N", col: 30, tier: 0 },
    ],
  },
];
