# Data binding and Views

Every view is passed options by using the static method `with`:

```
class HomeView extends View {
    @layout.fullSize()
    background = Surface.with({properties: {backgroundColor: 'red'}})
}
```

(See the full source code of the view [here](https://pastebin.com/WzUJW3Vc))

In order to change the background color dynamically, the background color is defined as an option:


```
@bindings.setup({
    backgroundColor: 'red'
})
class HomeView extends View {
....
```

The `backgroundColor` can then be referenced inside the view:

```
    background = Surface.with({properties: {backgroundColor: this.options.backgroundColor}})
```

It can be changed in different ways, one being [events](http://localhost:63342/arva-js/docs/variable/index.html#static-variable-event).

```
    @event.on('click', function() {
        this.options.backgroundColor = 'green';
    })
    background = Surface.with({properties: {backgroundColor: this.options.backgroundColor}})
```

## Chained decorators

All decorators of the same type ([layout](http://localhost:63342/arva-js/docs/variable/index.html#static-variable-layout), [event](http://localhost:63342/arva-js/docs/variable/index.html#static-variable-event), and [flow](http://localhost:63342/arva-js/docs/variable/index.html#static-variable-flow)) can be chained when used.

```
    @layout.dock.top()
        .size(undefined, true)
    centeredText = Surface.with({content: 'This is centered!'})
```

Is the same as


```
    @layout.dock.top()
    @layout.size(undefined, true)
    centeredText = Surface.with({content: 'This is centered!'})
```


## Two-way data binding

Data can go two ways. An example of data that becomes modified is the value of the [InputSurface](http://localhost:63342/arva-js/docs/class/src/surfaces/InputSurface.js~InputSurface.html).
```
    @layout.dock.top()
        .size(undefined, true)
    question = InputSurface.with({
        placeholder: 'What is your name?',
        @bindings.onChange((value) => {
            this.options.myName = value;
        })
        value: this.options.myName
    })

    @layout.dock.top()
        .size(undefined, true)
    answer = Surface.with({
        content: this.options.myName ? `Your name is ${this.options.myName}` : `You have no name`
    })
    ```



