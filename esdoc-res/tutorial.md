# What's Arva JS?

Arva JS solves the problem of **layout** and **animation** without the need to bother with CSS nor HTML. While CSS is still used for **styling** of the content, whereas **positioning** and **sizing** is handled through different processes. 
Arva astracts away some of the concerns that many front-end developers face,
which includes CSS deep-dives and directives like `display: inline-block` `margin:auto`, `position:relative`, `clear:left`, `float: right`, `zoom: 1` `overflow: auto`, `-webkit-box-sizing: border-box` and so on.
 
Even modern paradigms like flexbox won't be necessary anymore. Let's get started.

## Animations and states

Animation states can be defined using the [flow](http://localhost:63342/arva-js/docs/variable/index.html#static-variable-flow) operator.

The core concept of Flow is that the renderables can have multiple **states**, 
each of which contain a collection of layout properties. 

When the renderable changes from one state to another using the [layout](http://localhost:63342/arva-js/docs/variable/index.html#static-variable-layout) operations,
their **layout properties** are tweened into each other, creating the effect of seamless animation.


```javascript
    @flow.stateStep('hidden', layout.opacity(0))
    @flow.stateStep('shown', layout.opacity(1))
    layer = Surface.with({properties: {backgroundColor: 'red'}});
```

For a contextual example of using flow and animation, we made a sample component for showing and hiding a menu:

![animation](asset/animation-demo.gif)

[Source code can be found here under 'stateful-animations'](https://github.com/Arva/demo)



# Data binding and Views

Every view is passed options by using the static method `with`:

```
class HomeView extends View {
    @layout.fullSize()
    background = Surface.with({properties: {backgroundColor: 'red'}})
}
```

(See the full source code of the view [here](https://pastebin.com/WzUJW3Vc))

In order to change an option dynamically, the background color in the example is defined as an option:


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

It can be changed through different triggers, one being [events](http://localhost:63342/arva-js/docs/variable/index.html#static-variable-event).

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
        content: this.options.myName ? 
        `Your name is ${this.options.myName}` : `You have no name`
    })
```
    
For a more advanced example on databinding, we made an app that could come in handy when trying to calculate the
value of your car after a crash:

![logo](asset/dbinding-demo.gif)



[Source code can be found here under 'data-binding'](https://github.com/Arva/demo)
        

# But what about React?

At first glance, it might not be evident what the benefit of Arva is over other frameworks. In particular, the 
absence of JSX or templating language seems foreign as almost every other framework is using their own custom language. 
An app written with Arva is written with plain (draft stage) ECMAScript syntax. The strict adherence to this standard future-proofs Arva to 
be able to run natively in the browser, and also opens up for more super powers as the ECMAScript standard progresses further.

Another important difference to recall is that Arva is an MVC framework, where heavy data logic is put in the controller, rather
than being view-only, as is the case with frameworks like React. React and Arva do in this regard have different approaches, 
since React is a framework intended as a component of a bigger picture, whereas Arva is the stand-alone solution for your entire app.

Let's consider a very simple example of an Arva view and its (approximate) counter-part in React, 
to serve as a basis for further discussion.


```javascript
@bindings.setup({
    titleText: 'Welcome'
})
class HomeView extends View {
    @layout.dock.top(44)
    topBar = TopBar.with({titleText:this.options.titleText})
    
    @layout.dock.fill()
    content = Content.with()
    
    changeTitle(newTitle) {
        this.options.titleText = newTitle 
    }
}
```

And now in React. Note that this definition won't include positioning and sizing, which would need custom CSS/HTML configurations.

```javascript
class HomeComponent extends Component {
    constructor(props, context){
        super(props, context);
        this.state = {
            titleText: props.titleText
        }
    }
    changeTitle(newTitle) {
        this.setState({titleText: newTitle})
    }

    render() {
        return (
            <TopBar titleText=this.state.titleText/>
            <Content />
        )
    }

}
HomeComponent.defaultProps = {titleText: 'Welcome'};

```


## State updates

React is focused on building sound app logic, on simple views using the pure `render` function. Arva does not have a 
render function, which means that when an update is needed (`setState` in React, or option assignment in Arva), Arva
can go a different route. When titleText is called, the function assigning `HomeView.topBar` will be called again
(`TopBar.with({titleText:this.options.titleText})`), so that the TopBar updates. 

In the case React, the render() function will be called upon invalidation, causing a re-render of both the TopBar *and* the content.

We chose to optimize state updates by taking control over the `options` object of each view, linking the accesses of each
option to their relevant child views. When the child views are updated, the new options will be diffed with the old ones
in order to restrict what children should be updated inside *that* view. The getters and setters work for an arbitrary
level of nestedness inside the `options` object.

Based on the above description, one might object with the concern that performing deep checks for every update sounds 
really inefficient. In response to that we've learned by experience that the different `options` objects are generally
not nested nor overly complicated, but rather the *View hierarchy* tends to be much more intricate. By avoiding huge
renders of completely updated view hierarchy we instead focus on limiting this and focusing on detecting a limited
subset of `option` updates. For React developers, you might think of the options propagation to children as
 if every View was a `PureComponent`.



## Layout and Animation
 
By not using JSX or other markup, we can use ES2017 decorators to focus on layout. Layout is abstracted away from the user
in order to provide flexible animations. The actual HTML output of Arva results in absolutely positioned elements in a rather
 flat structure, in order to be as flexible as possible. When using a normal framework that requires you to define the
 HTML manually, animations are usually implemented in a bit more awkward fashion.

All positioning and sizing done through decorators is hardware accelerated, so
the programmer can comfortably know that the animations defined won't stress the browser unnecessarily. 
The decorator structure of Arva provides a natural solution for layout definition. In order to clarify why this is important,
 we will revisit the example we covered in a previous section, with the animating hamburger icon:
  
![button](asset/button.gif)
  
The animation declaration is optimized in being as straight forward as possible, so that transition states are defined
in an additive nature from the previous position, while tasks like centering content in relation to parent and proportional
 size are still easy to achieve.

Here's the code, with plenty of comments, for clarity:

```javascript
    
    /* We start with the top part of the hamburger, 
     * which starts in a horizontal state, which we name 'straight'
     */
    @flow.defaultState('straight', {}, layout
    /* We center it and translate 8 pixels upwards */
            .stick.center()
            .translate(0, -8, 0)
    /* Size is 60% of parent size and 3 pixels high */ 
            .size(0.6, 3)
    /* No rotation */
            .rotate(0, 0, 0))
    /* This is the animation for going to the X. 
     * We call the state of this part "tilted". */
    @flow.stateStep('tilted', {}, layout
    /* The first part of tilting the stick involves 
     * centering all three lines together.
     * That means that we center the top part, by translating it to the middle */
        .translate(0, 0, 0))
    @flow.stateStep('tilted', {}, layout
    /* We then rotate it 45 degrees, which is the same as Math.PI / 4 */
        .rotate(0, 0, Math.PI / 4)
    )
    /* We defined a simple component with a white background 
     * which is used for every portion of the icon 
     */
    topStick = WhiteShape.with();

    /* The middle part is easy. We just hide it when the icon turns into 
     * the X (since that's just two lines instaed of three) */
    @flow.defaultState('shown', {}, layout
        .stick.center()
        .translate(0, 0, 0)
        .size(0.6, 3)
        .opacity(1))
    @flow.stateStep('hidden', {}, layout
        .opacity(0))
    centerStick = WhiteShape.with();

    /* The bottom part is very similar to the top one, 
     * but with a rotation going in the opposite direction, 
     * and a translate 8 pixels down instead of 8 pixels up 
     */
    @flow.stateStep('tilted', {}, layout
        .translate(0, 0, 0))
    @flow.stateStep('tilted', {}, layout
        .rotate(0, 0, -Math.PI / 4)
    )
    @flow.defaultState('straight', {}, layout
        .translate(0, 8, 0)
        .stick.center()
        .rotate(0, 0, 0)
        .size(0.6, 3))
    bottomStick = WhiteShape.with();
```
 
# The bigger picture 

We will continue to improve Arva JS in every aspect, including performance, UX possibilities and code brevity. It's a framework
that is going to be frequently revised and evaluated for its goals.

Arva JS is sometimes referred to as *Arva foundation* or *Arva engine* and is a part of a bigger scheme of making 
easy and attractive development possible for more people. *Arva Studio* is under development in order to provide a no-code
springboard for rapid application development. 
 
 


