/**
 * Created by tom on 23/10/15.
 */

import System                   from '../node_modules/systemjs/index.js';

export function loadDependencies(dependencies) {
    let imports = {};
    let promises = [];

    promises.push(loadConfig());

    for (let key in dependencies) {
        let dependencyLocation = dependencies[key];
        promises.push(System.import(dependencyLocation).then((importedObject) => {
            imports[key] = importedObject[key];
        }))
    }

    return Promise.all(promises).then(() => { return Promise.resolve(imports); });
}

export function loadConfig() {
    return System.import('./config.js');
}