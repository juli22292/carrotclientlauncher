const TYPES = ['mod', 'modpack', 'shader', 'resourcepack'];
const ORDERS = ['relevance', 'downloads', 'follows', 'newest', 'updated'];

function searchParameters({ query = '', type = 'mod', offset = 0, limit = 20, index = 'downloads', category = '', exclude = [] } = {}, instance) {
  if (!TYPES.includes(type) || typeof query !== 'string' || query.length > 200 || !ORDERS.includes(index)) throw new Error('Ungültige Suche.');
  if (typeof category !== 'string' || !/^[a-z0-9-]{0,60}$/.test(category)) throw new Error('Ungültige Kategorie.');
  if (!Number.isInteger(offset) || offset < 0 || offset > 100000 || ![12,20,40].includes(limit)) throw new Error('Ungültige Suchseite.');
  if (!Array.isArray(exclude) || exclude.length > 2000 || exclude.some(id => typeof id !== 'string' || !/^[-\w]{1,100}$/.test(id))) throw new Error('Ungültige Projektfilter.');
  const facets = [[`project_type:${type}`]];
  if (instance) {
    facets.push([`versions:${instance.version}`]);
    // Modpacks create their own instance, including their own loader.
    if (type === 'mod') facets.push([`categories:${instance.loader}`]);
  }
  if (category) facets.push([`categories:${category}`]);
  for (const id of exclude) facets.push([`project_id != ${id}`]);
  return new URLSearchParams({ query, facets: JSON.stringify(facets), index, limit: String(limit), offset: String(offset) });
}
module.exports = { searchParameters };
