/**


 @author: Tom Clement (tjclement)
 @license NPOSL-3.0
 @copyright Bizboard, 2015

 */

import merge                from 'lodash/merge.js';
import extend               from 'lodash/extend.js';

export class ObjectHelper {

    /* Sets enumerability of methods and all properties starting with '_' on an object to false,
     * effectively hiding them from for(x in object) loops.   */
    static hideMethodsAndPrivatePropertiesFromObject(object) {
        for (let propName in object) {

            let prototype = Object.getPrototypeOf(object);
            let descriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, propName) : undefined;
            if (descriptor && (descriptor.get || descriptor.set) && !propName.startsWith('_')) {
                /* This is a public getter/setter, so we can skip it */
                continue;
            }

            let property = object[propName];
            if (typeof property === 'function' || propName.startsWith('_')) {
                ObjectHelper.hidePropertyFromObject(object, propName);
            }
        }
    }

    /* Sets enumerability of methods on an object to false,
     * effectively hiding them from for(x in object) loops.   */
    static hideMethodsFromObject(object) {
        for (let propName in object) {
            let property = object[propName];
            if (typeof property === 'function') {
                ObjectHelper.hidePropertyFromObject(object, propName);
            }
        }
    }

    /* Sets enumerability of an object's property to false,
     * effectively hiding it from for(x in object) loops.   */
    static hidePropertyFromObject(object, propName) {
        let prototype = object;
        let descriptor = Object.getOwnPropertyDescriptor(object, propName);
        while (!descriptor) {
            prototype = Object.getPrototypeOf(prototype);

            if (prototype.constructor.name === 'Object' || prototype.constructor.name === 'Array') {
                return;
            }

            descriptor = Object.getOwnPropertyDescriptor(prototype, propName);
        }
        descriptor.enumerable = false;
        Object.defineProperty(prototype, propName, descriptor);
        Object.defineProperty(object, propName, descriptor);
    }

    /* Sets enumerability of all of an object's properties (including methods) to false,
     * effectively hiding them from for(x in object) loops.   */
    static hideAllPropertiesFromObject(object) {
        for (let propName in object) {
            ObjectHelper.hidePropertyFromObject(object, propName);
        }
    }

    /* Adds a property with enumerable: false to object */
    static addHiddenPropertyToObject(object, propName, prop, writable = true, useAccessors = true) {
        return ObjectHelper.addPropertyToObject(object, propName, prop, false, writable, undefined, useAccessors);
    }

    /* Adds a property with given enumerability and writability to object. If writable, uses a hidden object.shadow
     * property to save the actual data state, and object[propName] with gettter/setter to the shadow. Allows for a
     * callback to be triggered upon every set.   */
    static addPropertyToObject(object, propName, prop, enumerable = true, writable = true, setCallback = null, useAccessors = true) {
        /* If property is non-writable, we won't need a shadowed prop for the getters/setters */
        if (!writable || !useAccessors) {
            let descriptor = {
                enumerable: enumerable,
                writable: writable,
                value: prop
            };
            Object.defineProperty(object, propName, descriptor);
        } else {
            ObjectHelper.addGetSetPropertyWithShadow(object, propName, prop, enumerable, writable, setCallback);
        }
    }

    /* Adds given property to the object with get() and set() accessors, and saves actual data in object.shadow */
    static addGetSetPropertyWithShadow(object, propName, prop, enumerable = true, writable = true, setCallback = null) {
        ObjectHelper.buildPropertyShadow(object, propName, prop);
        ObjectHelper.buildGetSetProperty(object, propName, enumerable, writable, setCallback);
    }

    /* Creates or extends object.shadow to contain a property with name propName */
    static buildPropertyShadow(object, propName, prop) {
        let shadow = {};

        try {
            /* If a shadow property already exists, we should extend instead of overwriting it. */
            if ('shadow' in object) {
                shadow = object.shadow;
            }
        } catch (error) {
            return;
        }

        shadow[propName] = prop;
        Object.defineProperty(object, 'shadow', {
            writable: true,
            configurable: true,
            enumerable: false,
            value: shadow
        });
    }

    /* Creates a property on object that has a getter that fetches from object.shadow,
     * and a setter that sets object.shadow as well as triggers setCallback() if set.   */
    static buildGetSetProperty(object, propName, enumerable = true, writable = true, setCallback = null) {
        let descriptor = {
            enumerable: enumerable,
            configurable: true,
            get: function () {
                return object.shadow[propName];
            },
            set: function (value) {
                if (writable) {
                    object.shadow[propName] = value;
                    if (setCallback && typeof setCallback === 'function') {
                        setCallback({
                            propertyName: propName,
                            newValue: value
                        });
                    }
                } else {
                    throw new ReferenceError('Attempted to write to non-writable property ' + propName + '.');
                }
            }
        };

        Object.defineProperty(object, propName, descriptor);
    }

    /* Calls object['functionName'].bind(bindTarget) on all of object's functions. */
    static bindAllMethods(object, bindTarget) {
        /* TODO: There is a bug here that will bind properties that were defined through this.x = <something>. This is
         * the desired effect because this.x.prototype will be redefined */

        /* Bind all current object's methods to bindTarget. */
        let methodDescriptors = ObjectHelper.getMethodDescriptors(object);
        for (let methodName in methodDescriptors) {
            /* Skip the constructor as it serves as no purpose and it breaks the minification */
            if(methodName === 'constructor'){
                continue;
            }
            let propertyDescriptor = methodDescriptors[methodName];
            if (propertyDescriptor && propertyDescriptor.get) {
                propertyDescriptor.get = propertyDescriptor.get.bind(bindTarget);
            } else if (propertyDescriptor.set) {
                propertyDescriptor.set = propertyDescriptor.set.bind(bindTarget);
            } else if (propertyDescriptor.writable) {
                propertyDescriptor.value = propertyDescriptor.value.bind(bindTarget);
            }
            Object.defineProperty(object, methodName, propertyDescriptor);
        }
    }


    static getMethodDescriptors(object) {

        let methodDescriptors = {};

        for (let propertyName of Object.getOwnPropertyNames(object)) {
            let propertyDescriptor = Object.getOwnPropertyDescriptor(object, propertyName) || {};
            /* Initializers can be ignored since they are bound anyways */
            if (!propertyDescriptor.initializer && (propertyDescriptor.get || typeof object[propertyName] === 'function')) {
                methodDescriptors[propertyName] = propertyDescriptor;
            }
        }

        /* Recursively find prototype's methods until we hit the Object prototype. */
        let prototype = Object.getPrototypeOf(object);
        if (prototype.constructor.name !== 'Object' && prototype.constructor.name !== 'Array') {
            methodDescriptors = extend(ObjectHelper.getMethodDescriptors(prototype), methodDescriptors);
        }

        return methodDescriptors;

    }

    /* Returns a new object with all enumerable properties of the given object */
    static getEnumerableProperties(object) {

        return ObjectHelper.getPrototypeEnumerableProperties(object, object);

    }

    static getPrototypeEnumerableProperties(rootObject, prototype) {
        let result = {};

        /* Collect all propertise in the prototype's keys() enumerable */
        let propNames = Object.keys(prototype);
        for (let name of propNames) {
            let value = rootObject[name];

            /* Value must be a non-null primitive or object to be pushable to a dataSource */
            if (value !== null && value !== undefined && typeof value !==
                'function') {
                if (typeof value === 'object' && !(value instanceof Array)) {
                    result[name] = ObjectHelper.getEnumerableProperties(value);
                } else {
                    result[name] = value;
                }
            }
        }

        /* Collect all properties with accessors (getters/setters) that are enumerable, too */
        let descriptorNames = Object.getOwnPropertyNames(prototype);
        descriptorNames = descriptorNames.filter(function (name) {
            return propNames.indexOf(name) < 0;
        });
        for (let name of descriptorNames) {
            let descriptor = Object.getOwnPropertyDescriptor(prototype, name);
            if (descriptor && descriptor.enumerable) {
                let value = rootObject[name];

                /* Value must be a non-null primitive or object to be pushable to a dataSource */
                if (value !== null && value !== undefined && typeof value !== 'function') {
                    if (typeof value === 'object' && !(value instanceof Array)) {
                        result[name] = ObjectHelper.getEnumerableProperties(value);
                    } else {
                        result[name] = value;
                    }
                }
            }
        }

        /* Collect all enumerable properties in the prototype's prototype as well */
        let superPrototype = Object.getPrototypeOf(prototype);
        let ignorableTypes = ['Object', 'Array', 'EventEmitter'];
        if (ignorableTypes.indexOf(superPrototype.constructor.name) === -1) {
            let prototypeEnumerables = ObjectHelper.getPrototypeEnumerableProperties(rootObject, superPrototype);
            merge(result, prototypeEnumerables);
        }

        return result;
    }
}
