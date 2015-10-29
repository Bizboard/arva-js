/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */

import _                from 'lodash';
import FlexScrollView   from 'famous-flex/src/FlexScrollView.js';
import {ObjectHelper}   from 'arva-utils/ObjectHelper.js';
import {Throttler}      from 'arva-utils/Throttler.js';


export class DataBoundScrollView extends FlexScrollView {

    constructor(OPTIONS = {}) {
        super(_.extend({
            autoPipeEvents: true,
            throttleDelay: 0, /* If set to 0, no delay is added in between adding items to the DataBoundScrollView. */
            dataSource: [],
            sortingDirection: 'ascending',
            flow: true,
            flowOptions: {
                spring: {               // spring-options used when transitioning between states
                    dampingRatio: 0.8,  // spring damping ratio
                    period: 1000        // duration of the animation
                },
                insertSpec: {           // render-spec used when inserting renderables
                    opacity: 0          // start opacity is 0, causing a fade-in effect,
                }
            }
        }, OPTIONS));
        ObjectHelper.bindAllMethods(this, this);

        this.isGrouped = this.options.groupBy != null;
        this.isDescending = this.options.sortingDirection === 'descending';
        this.throttler = new Throttler(this.options.throttleDelay, true, this);

        /* If no orderBy method is set, or it is a string field name, we set our own ordering method. */
        if (this.options.orderBy && typeof this.options.orderBy === 'string') {
            let fieldName = this.options.orderBy || 'id';
            this.options.orderBy = function (currentChild, compareChild) {
                if (this.isDescending) {
                    return currentChild[fieldName] > compareChild.data[fieldName];
                } else {
                    return currentChild[fieldName] < compareChild.data[fieldName];
                }
            }.bind(this);
        }

        /* If present in options.headerTemplate or options.placeholderTemplate, we build the header and placeholder elements. */
        this._addHeader();
        this._addPlaceholder();

        if (this.options.dataStore) {
            this._bindDataSource(this.options.dataStore);
        } else {
            console.log('No DataSource was set.');
        }
    }
    /**
     * Set a template function
     * @param templateFunction
     */
    setItemTemplate(templateFunction = {}){
        this.options.itemTemplate = templateFunction;
    }

    /**
     * Reloads the dataFilter option of the DataBoundScrollView, and verifies whether the items in the dataStore are allowed by the new filter.
     * It removes any currently visible items that aren't allowed anymore, and adds any non-visible ones that are allowed now.
     * @param {Function} newFilter New filter function to verify item visibility with.
     * @param {Boolean} reRender Boolean to rerender all childs that pass the filter function. Usefull when setting a new itemTemplate alongside reloading the filter
     * @returns {void}
     */
    reloadFilter(newFilter, reRender = false) {
        this.options.dataFilter = newFilter;

        for (let entry of this.options.dataStore) {
            if(reRender) this._removeItem(entry);
            let surface = _.find(this._dataSource, (surface) => surface.dataId === entry.id);
            let alreadyExists = surface !== undefined;
            let result = newFilter(entry);

            if (result instanceof Promise) {
                result.then(function (shouldShow) { this._handleNewFilterResult(shouldShow, alreadyExists, entry); }.bind(this))
            } else {
                this._handleNewFilterResult(result, alreadyExists, entry);
            }
        }
    }

    _handleNewFilterResult(shouldShow, alreadyExists, entry) {
        if (shouldShow) {
            /* This entry should be in the view, add it if it doesn't exist yet. */
            if (!alreadyExists) {
                this._addItem(entry);
            }
        } else {
            /* This entry should not be in the view, remove if present. */
            if (alreadyExists) {
                this._removeItem(entry);
            }
        }
    }

    _findGroup(groupId) {
        return _.findIndex(this._dataSource, function (surface) {
            return surface.groupId === groupId;
        });
    }

    _findNextGroup(fromIndex) {
        let dslength = this._dataSource.length;
        for (let pos = fromIndex; pos < dslength; pos++) {
            if (this._dataSource[pos].groupId) {
                return pos;
            }
        }

        return this._dataSource.length;
    }


    _getGroupByValue(child) {
        let groupByValue = '';
        if (typeof this.options.groupBy === 'function') {
            groupByValue = this.options.groupBy(child);
        } else if (typeof this.options.groupBy === 'string') {
            groupByValue = this.options.groupBy;
        }
        return groupByValue;
    }

    _addGroupItem(groupByValue, insertIndex) {
        let newSurface = this.options.groupTemplate(groupByValue);
        newSurface.groupId = groupByValue;

        this.insert(insertIndex, newSurface);
    }

    _getInsertIndex(child, previousSiblingID = null) {
        /* By default, add item to the beginning if descending order, or at the end otherwise. */
        let firstIndex = this.header ? 1 : 0;
        let insertIndex = this.isDescending ? firstIndex : this._dataSource.length;

        /* If we have an orderBy function, find the index we should be inserting at. */
        if (this.options.orderBy && typeof this.options.orderBy === 'function') {
            let foundOrderedIndex = _.findIndex(this._dataSource, function (compareChild) {

                /* Ignore the header, placeholder, and group items. */
                if (!compareChild.isHeader && !compareChild.isPlaceholder && !compareChild.groupId) {
                    return this.options.orderBy(child, compareChild);
                }
                return false;

            }.bind(this));

            if (foundOrderedIndex !== -1) {
                insertIndex = foundOrderedIndex;
            }
        } else if (previousSiblingID) {
            /* We don't have an orderBy method, but do have a previousSiblingID we can use to find the correct insertion index. */
            let siblingIndex = _.findIndex(this._dataSource, (sibling) => sibling.dataId === previousSiblingID);
            if (siblingIndex !== -1) {
                insertIndex = siblingIndex + 1;
            }
        }

        if(this.isGrouped && insertIndex === firstIndex && this._dataSource[insertIndex] && this._dataSource[insertIndex].groupId
            && this._dataSource[insertIndex].groupId === this._getGroupByValue(child)) {
            /* We didn't get an insert index from the ordering method or a previous sibling ID, and our insert index is already occupied by
             * a group item that we need to insert after, so we'll move the index to after the group item. */
            insertIndex++;
        } else if (this.isGrouped && insertIndex > 0 && this._dataSource[insertIndex-1] && this._dataSource[insertIndex-1].groupId
            && this._dataSource[insertIndex-1].groupId !== this._getGroupByValue(child)) {
            /* The insert index is after a group item that this child does not belong to, so we'll have to decrement the index by one
             * to avoid the child being added under this group. */
            insertIndex--;
        }

        return insertIndex;
    }

    _addItem(child, previousSiblingID) {
        if(_.findIndex(this._dataSource, (dataItem) => dataItem.dataId === child.id) !== -1) {
            /* Child already exists, so we won't add it again. */
            return;
        }

        this._removePlaceholder();

        let insertIndex = this._getInsertIndex(child, previousSiblingID);

        /* If we're using groups, check if we need to insert a group item before this child. */
        if (this.isGrouped) {
            let groupByValue = this._getGroupByValue(child);
            let groupIndex = this._findGroup(groupByValue);
            if (groupIndex === -1) {
                /* No group of this value exists yet, so we'll need to create one. */
                this._addGroupItem(groupByValue, insertIndex);
                insertIndex++;
            }
        }

        let newSurface = this.options.itemTemplate(child);
        newSurface.dataId = child.id;
        newSurface.data = child;
        newSurface.on('click', function () {
            this._eventOutput.emit('child_click', {renderNode: newSurface, dataObject: child});
        }.bind(this));

        this.insert(insertIndex, newSurface);
    }


    _replaceItem(child) {
        let index = this._getDataSourceIndex(child.id);

        let newSurface = this.options.itemTemplate(child);
        newSurface.dataId = child.id;
        this.replace(index, newSurface);
    }


    _removeItem(child) {
        let index = _.findIndex(this._dataSource, function (surface) {
            return surface.dataId === child.id;
        });

        if (index > -1) {
            this.remove(index);
        }

        /* If we're using groups, check if we need to remove the group that this child belonged to. */
        if (this.isGrouped) {
            let groupByValue = this._getGroupByValue(child);
            let otherGroupChilds = _.findIndex(this._dataSource, function (otherChild) {
                return this._getGroupByValue(otherChild) === groupByValue;
            }.bind(this));

            if (otherGroupChilds === -1) {
                /* No more childs in this group, so let's remove the group. */
                let groupIndex = this._findGroup(groupByValue);
                if (groupIndex !== -1) {
                    this.remove(groupIndex);
                }
            }
        }

        /* The amount of items in the dataSource is subtracted with a header if present, to get the total amount of actual items in the scrollView. */
        let itemCount = this._dataSource.length - (this.header ? 1 : 0);
        if (itemCount === 0) {
            this._addPlaceholder();
        }
    }


    _moveItem(oldId, prevChildId = null) {

        let oldIndex = this._getDataSourceIndex(oldId);
        let previousSiblingIndex = this._getNextVisibleIndex(prevChildId);

        if (oldIndex !== previousSiblingIndex) {
            this.move(oldIndex, previousSiblingIndex);
        }
    }

    _addHeader() {
        if (this.options.headerTemplate && !this.header) {
            this.header = this.options.headerTemplate();
            this.header.isHeader = true;
            this.insert(0, this.header);
        }
    }

    _addPlaceholder() {
        if (this.options.placeholderTemplate && !this.placeholder) {
            let insertIndex = this.header ? 1 : 0;
            this.placeholder = this.options.placeholderTemplate();
            this.placeholder.dataId = this.placeholder.id = '_placeholder';
            this.placeholder.isPlaceholder = true;
            this.insert(insertIndex, this.placeholder);
        }
    }

    _removePlaceholder() {
        if (this.placeholder) {
            this._removeItem(this.placeholder);
            this.placeholder = null;
        }
    }

    _bindDataSource() {

        if (!this.options.dataStore || !this.options.itemTemplate) {
            console.log('Datasource and template should both be set.');
            return;
        }

        if (!this.options.template instanceof Function) {
            console.log('Template needs to be a function.');
            return;
        }

        this.options.dataStore.on('child_added', function (child, previousSiblingID) {

            if (this.options.dataFilter &&
                (typeof this.options.dataFilter === 'function')) {

                let result = this.options.dataFilter(child);

                if (result instanceof Promise) {
                    /* If the result is a Promise, show the item when that promise resolves. */
                    result.then((show) => { if (show) { this.throttler.add(() => { return this._addItem(child), previousSiblingID; }); } });
                } else if (result) {
                    /* The result is an item, so we can add it directly. */
                    this.throttler.add(() => { return this._addItem(child, previousSiblingID); });
                }
            } else {
                /* There is no dataFilter method, so we can add this child. */
                this.throttler.add(() => { return this._addItem(child, previousSiblingID); });
            }
        }.bind(this));


        this.options.dataStore.on('child_changed', function (child, previousSiblingID) {
            let changedItem = this._getDataSourceIndex(child.id);

            if (this._dataSource && changedItem < this._dataSource.length) {

                let result = this.options.dataFilter(child);

                if(result instanceof Promise){
                    result.then(function(show) {
                        if(show) {
                            this.throttler.add(() => { return this._replaceItem(child); });
                            this.throttler.add(() => { return this._moveItem(child.id, previousSiblingID); })
                        } else {
                            this._removeItem(child);
                        }
                    }.bind(this));
                }
                else if (this.options.dataFilter &&
                    typeof this.options.dataFilter === 'function' && !result) {
                    this._removeItem(child);
                } else {
                    if (changedItem === -1) {
                        this.throttler.add(() => { return this._addItem(child, previousSiblingID); });
                    } else {
                        this.throttler.add(() => { return this._replaceItem(child); });
                        this.throttler.add(() => { return this._moveItem(child.id, previousSiblingID); });
                    }
                }
            }
        }.bind(this));


        this.options.dataStore.on('child_moved', function (child, previousSibling) {
            let current = this._getDataSourceIndex(child.id);
            let previous = this._getDataSourceIndex(previousSibling);
            this.throttler.add(() => { return this._moveItem(current, previous); });
        }.bind(this));


        this.options.dataStore.on('child_removed', function (child) {
            this.throttler.add(() => { return this._removeItem(child); });
        }.bind(this));
    }


    _getDataSourceIndex(id) {
        return _.findIndex(this._dataSource, function (surface) {
            return surface.dataId === id;
        });
    }


    _getNextVisibleIndex(id) {

        let viewIndex = this._getDataSourceIndex(id);
        if (viewIndex === -1) {
            let modelIndex = _.findIndex(this.options.dataStore, function (model) {
                return model.id === id;
            });

            if (modelIndex === 0 || modelIndex === -1) {
                return this.isDescending ? this._dataSource ? this._dataSource.length - 1 : 0 : 0;
            } else {
                let nextModel = this.options.dataStore[this.isDescending ? modelIndex + 1 : modelIndex - 1];
                let nextIndex = this._getDataSourceIndex(nextModel.id);
                if (nextIndex > -1) {

                    return this.isDescending ? nextIndex === 0 ? 0 : nextIndex - 1 :
                           this._dataSource.length === nextIndex + 1 ? nextIndex : nextIndex + 1;
                } else {
                    return this._getNextVisibleIndex(nextModel.id);
                }
            }
        } else {
            return this.isDescending ? viewIndex === 0 ? 0 : viewIndex - 1 :
                   this._dataSource.length === viewIndex + 1 ? viewIndex : viewIndex + 1;
        }
    }
}