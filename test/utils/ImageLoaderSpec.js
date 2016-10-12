/**
 * Created by tom on 26/03/16.
 */

/* global describe, it, before, beforeEach, after, afterEach */

import sinon                        from 'sinon';
import chai                         from 'chai';
import {loadDependencies,
    mockDependency}                 from '../meta/TestBootstrap.js';

let should = chai.should();

describe('ImageLoader', () => {
    let imports = {};

    before(() =>  loadDependencies({
                ImageLoader: System.normalizeSync('./src/utils/ImageLoader.js')}
        ).then((importedObjects) => {
                imports = importedObjects;
            })
    );

    describe('#constructor', () => {
        it('imports without exceptions', () => {
            let reference = imports.ImageLoader;
            should.exist(reference);
        });
    });
});