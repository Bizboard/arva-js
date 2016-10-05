/**
 * Created by tom on 14/03/16.
 */

import chai                         from 'chai';
import {loadDependencies}           from '../meta/TestBootstrap.js';

let should = chai.should();

describe('BrandingEngine', () => {
    let imports = {};

    before(() => {
        return loadDependencies({
            Injection: './src/utils/Injection.js',
            BrandingEngine: './src/components/logic/branding/BrandingEngine.js',
            BrandingEngineSingleton: './src/components/logic/branding/BrandingEngineSingleton.js'
        }).then((importedObjects) => { imports = importedObjects; });
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.BrandingEngine();
            should.exist(instance);
        });
        it('returns singleton without exceptions', () => {
            imports.Context.buildContext();
            let instance = imports.BrandingEngineSingleton.getInstance();
            should.exist(instance);
        });
    });
});