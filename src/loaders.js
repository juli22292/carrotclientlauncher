import definitions from '../electron/loader-definitions.json';
export const loaders = definitions;
export const loaderName = id => definitions.find(loader => loader.id === id)?.name || id;
export const modLoaders = definitions.filter(loader => loader.id !== 'vanilla');
