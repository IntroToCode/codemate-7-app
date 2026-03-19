const MOCK_RESTAURANTS = [
  { name: 'chipotle', cuisine: 'Mexican', price_range: 1, address: '123 Burrito Blvd, San Francisco, CA' },
  { name: 'shake shack', cuisine: 'American', price_range: 2, address: '456 Burger Ave, New York, NY' },
  { name: 'nobu', cuisine: 'Japanese', price_range: 4, address: '789 Sushi Lane, Beverly Hills, CA' },
  { name: 'sweetgreen', cuisine: 'Salads', price_range: 2, address: '321 Greens Way, Washington, DC' },
  { name: 'the melting pot', cuisine: 'Fondue', price_range: 3, address: '654 Fondue Ct, Charlotte, NC' },
  { name: 'olive garden', cuisine: 'Italian', price_range: 2, address: '987 Pasta Pkwy, Orlando, FL' },
  { name: 'in-n-out', cuisine: 'American', price_range: 1, address: '111 Double-Double Dr, Los Angeles, CA' },
  { name: 'panda express', cuisine: 'Chinese', price_range: 1, address: '222 Orange Chicken Rd, Rosemead, CA' },
  { name: 'sushi nakazawa', cuisine: 'Japanese', price_range: 4, address: '23 Commerce St, New York, NY' },
  { name: 'the french laundry', cuisine: 'French', price_range: 4, address: '6640 Washington St, Yountville, CA' },
  { name: 'cinco', cuisine: 'Mexican', price_range: 3, address: '333 Taco Blvd, Austin, TX' },
  { name: 'pizza hut', cuisine: 'Pizza', price_range: 1, address: '444 Pizza Way, Dallas, TX' },
  { name: 'applebee\'s', cuisine: 'American', price_range: 2, address: '555 Riblet Rd, Kansas City, MO' },
  { name: 'benihana', cuisine: 'Japanese', price_range: 3, address: '666 Hibachi Hwy, Miami, FL' },
  { name: 'chick-fil-a', cuisine: 'American', price_range: 1, address: '777 Waffle Fry Ln, College Park, GA' },
];

/**
 * Look up mock autofill data for a restaurant name.
 * Case-insensitive partial match.
 *
 * @param {string} name
 * @returns {{ cuisine: string, price_range: number, address: string }}
 */
function autofill(name) {
  if (!name || typeof name !== 'string') {
    return { cuisine: '', price_range: 2, address: '' };
  }
  const lower = name.toLowerCase().trim();
  const match = MOCK_RESTAURANTS.find((r) => lower.includes(r.name) || r.name.includes(lower));
  if (match) {
    return { cuisine: match.cuisine, price_range: match.price_range, address: match.address };
  }
  return { cuisine: '', price_range: 2, address: '' };
}

module.exports = { autofill, MOCK_RESTAURANTS };
