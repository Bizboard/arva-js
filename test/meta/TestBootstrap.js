/**
 * Created by tom on 23/10/15.
 */

import System                   from 'systemjs';
import sinon                    from 'sinon';
import '../../config.js';

export function mockDependency(dependency, replacement){
    System.delete(System.normalizeSync(dependency));
    if(!replacement){
        replacement = sinon.stub();
    }
    if(typeof replacement === 'function'){
        replacement = {default: replacement};
    }
    System.set(System.normalizeSync(dependency), System.newModule(replacement));
}

export function loadDependencies(dependencies) {
    let imports = {};
    let promises = [];

    for (let key in dependencies) {
        let dependencyLocation = dependencies[key];
        promises.push(System.import(dependencyLocation).then((importedObject) => {
            imports[key] = importedObject[key] || importedObject.default || importedObject;
        }));
    }

    return Promise.all(promises).then(() => { return Promise.resolve(imports); });
}