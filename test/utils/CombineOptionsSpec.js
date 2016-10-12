/**
 * Created by lundfall on 3/28/16.
 */

/* global describe, it, before, beforeEach, after, afterEach */

import sinon                        from 'sinon';
import chai                         from 'chai';
import {loadDependencies,
    mockDependency}             from '../meta/TestBootstrap.js';

let should = chai.should();
let expect = chai.expect;

describe('CombineOptions', () => {
    let imports = {};

    before(() => {
        return loadDependencies({
            combineOptions: System.normalizeSync('./src/utils/CombineOptions.js')
        }).then((importedObjects) => {
            imports = importedObjects;
        });
    });

    describe('#methods', () => {
        it('returns one other parameter if the one of the parameters is empty', () => {
            let content = {a:1, b:2};
            let defaultParams = imports.combineOptions(content,{});
            let newParams = imports.combineOptions(content,{});
            expect(defaultParams).to.deep.equal(content);
            expect(newParams).to.deep.equal(content);
        });

        it('can override defualt properties', () => {
            expect(imports.combineOptions({a:1, b:2}, {a:3})).to.deep.equal({a:3, b:2});
        });

        it('modifies the default options', () => {
            let defaults = {a:1, b:2};
            imports.combineOptions(defaults, {a:3});
            expect(defaults).to.deep.equal({a:3, b:2});
        });

        it('merges camelCase with dash-case', () => {
            expect(imports.combineOptions({camelCase: 1, ignore: 3}, {'camel-case': 2})).to.deep.equal({camelCase: 2, ignore:3});
        });

        it('doesn\'t merge instances of classes', () => {
            class Example {}
            expect(imports.combineOptions({theClass: new Example()}, {theClass: {override: true}})).to.deep.equal({theClass: {override: true}});
        });

        it('merges arrays with undefined properties', () => {
            expect(imports.combineOptions({theSize: [undefined, 3, 4, 1, undefined]}, {theSize: [3, undefined, 4, 1]})).to.deep.equal(
                {theSize: [3, undefined, 4, 1, undefined]}
            )
        });

        it('handles a complex situation', () => {
            class Example {}
            let exampleInstance = new Example();
            let result = imports.combineOptions({defaultOpt: '444', camelCaseChild: {'dash-case-property': 1, nested: {a:{a:2, b:2}, b: 2}}}, {
                'camel-case-child': {
                    dashCaseProperty: 'new value',
                    nested: {a: exampleInstance, b: 2}
                }
            });
            expect(result).to.deep.equal({defaultOpt: '444', camelCaseChild: {dashCaseProperty: 'new value', nested: {a: exampleInstance, b: 2}}});
        });
    });
});