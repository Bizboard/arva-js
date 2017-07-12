/**
 * Created by lundfall on 9/28/16.
 */

var _ = require('lodash');

exports.onHandleAST = function (ev) {

    /*var mockedData = {
        type: 'ExportNamedDeclaration',
        start: 0,
        end: 10,
        loc: {start: {line: 24, column: 0}, end: {line: 24, column: 0}},
        specifiers: [],
        source: null,
        declaration: {
            type: 'FunctionDeclaration',
            start: 530,
            end: 555,
            id: {
                type: 'Identifier',
                start: 543,
                end: 548,
                loc: {start: {line: 24, column: 0}, end: {line: 24, column: 0}, identifierName: 'injectedFunction'},
                name: 'injectedFunction',
                leadingComments: null
            },
            generator: false,
            expression: false,
            async: false,
            params: [],
            body: {
                type: 'BlockStatement',
                start: 551,
                end: 555,
                loc: [{start: {line: 24, column: 0}, end: {line: 24, column: 0}}],
                body: [],
                directives: [],
                leadingComments: null,
                trailingComments: null
            },
            leadingComments: null,
            trailingComments: null
        },
        leadingComments: [{
            type: 'CommentBlock',
            value: `
     /!**
     * This is an injected function
     * @param {String} a
     * @param b
     * @param c
     * @return {String} something
     *!/`,
            start: 0,
            end: 10,
            loc: {start: {line: 24, column: 0}, end: {line: 24, column: 0}}
        }],
        trailingComments: null
    };*/


    var pushedFns = [];

    ev.data.ast.program.body.forEach((item, index) => {

        if(item.declaration === null){
            item.declaration = undefined;
        }
        /* Extracts documented inner properties in objects and fakes them at the end of the file */
        try {
            if (item && item.type === 'ExportNamedDeclaration' &&
                item.declaration &&
                item.declaration.type === 'VariableDeclaration' &&
                item.declaration.declarations &&
                item.declaration.declarations.length
            ) {

                var propertyName = item.declaration.declarations[0].id.name;
                console.log(`propertyName: ${JSON.stringify(propertyName)}`);
                item.declaration.declarations.forEach(function searchForObjectExpression(declaration) {
                    var leadingCommentsInsertion = [];
                    if (declaration.init && declaration.init.type === 'ObjectExpression' && declaration.init.properties) {
                        (function searchForFunctionExpression(properties, propertyName) {
                            properties.forEach((property)  => {
                                if (property.value && property.value.type === 'ObjectExpression') {
                                    searchForFunctionExpression(property.value.properties,propertyName + "." + property.key.name);
                                }
                                if (property.leadingComments && property.value && property.value.type === 'FunctionExpression') {
                                    var injectedProperty = _.clone(property);
                                    injectedProperty.type = 'ExportNamedDeclaration';
                                    delete injectedProperty.method;
                                    delete injectedProperty.shorthand;
                                    delete injectedProperty.computed;
                                    injectedProperty.specifiers = [];
                                    injectedProperty.source = null;
                                    injectedProperty.trailingComments = null;
                                    injectedProperty.declaration = _.clone(injectedProperty.value);

                                    if (!injectedProperty.declaration.id) {
                                        injectedProperty.declaration.id = _.clone(injectedProperty.key);
                                        injectedProperty.declaration.id.leadingComments = null;
                                    }
                                    injectedProperty.declaration.id.name = propertyName + '.' + injectedProperty.declaration.id.name;
                                    injectedProperty.declaration.type = 'FunctionDeclaration';
                                    injectedProperty.declaration.body.body = [];

                                    delete injectedProperty.value;
                                    delete injectedProperty.key;

                                    pushedFns.push(injectedProperty);

                                    leadingCommentsInsertion = leadingCommentsInsertion.concat(property.leadingComments);
                                }
                            });
                        })(declaration.init.properties, propertyName);
                    }
                });
            }
        }catch(e){
            console.log("Exception", e);
        }
    });
    ev.data.ast.program.body = ev.data.ast.program.body.concat(pushedFns);
    return ev;

}
;

exports.onHandleHTML = function (ev) {
    /* Remove all statements that go import {layout.size} from 'arva-js/layout.Decorators.js', etc*/
    ev.data.html = ev.data.html.replace(/(.*?import\s+\{.*?\..*?\}.*)/g, '');
    /* Remove the 'src/' in all statements that go import {layout} from 'arva-js/src/layout.Decorators.js', etc*/
    ev.data.html =  ev.data.html.replace(/(.*?import\s+\{.*?\}\s+from.*arva-js\/)src\//g, '$1');

    var headIndex = ev.data.html.indexOf('<head>');
    if(~headIndex){
        ev.data.html =  ev.data.html.slice(0, headIndex) + `<link href='http://fonts.googleapis.com/css?family=Lato:400,700' rel='stylesheet' type='text/css'>` + ev.data.html.slice(headIndex);
    }
    /* Replace the manual overview page (doesn't look so good) by the overview.html  */
    ev.data.html = ev.data.html.replace(/<a href="(.\/manual\/)index.html"/g, `<a href="$1overview/overview.html"`);
};

