import CanvasSurface from 'famous/surfaces/CanvasSurface.js'
import Timer from 'famous/utilities/Timer.js';


export class WebGLSurface extends CanvasSurface {

    constructor() {
        super(...arguments);
        this._parameters = {  start_time  : new Date().getTime(),
            time        : 0,
            screenWidth : 0,
            screenHeight: 0 };

        this.on('deploy', () => {
            let vertex_shader = `attribute vec3 position;

			void main() {

				gl_Position = vec4( position, 1.0 );

			}`;
            let fragment_shader = `uniform float time;
			uniform vec2 resolution;

			void main( void ) {

				vec2 position = - 1.0 + 2.0 * gl_FragCoord.xy / resolution.xy;
				float red = abs( sin( position.x * position.y + time / 5.0 ) );
				float green = abs( sin( position.x * position.y + time / 4.0 ) );
				float blue = abs( sin( position.x * position.y + time / 3.0 ) );
				gl_FragColor = vec4( red, green, blue, 1.0 );

			}`;
            let canvas = this._element;



            // Initialise WebGL


            this._gl = canvas.getContext( 'experimental-webgl' );


            // Create Vertex buffer (2 triangles)

            let buffer = this._gl.createBuffer();
            this._gl.bindBuffer( this._gl.ARRAY_BUFFER, buffer );
            this._gl.bufferData( this._gl.ARRAY_BUFFER, new Float32Array( [ - 1.0, - 1.0, 1.0, - 1.0, - 1.0, 1.0, 1.0, - 1.0, 1.0, 1.0, - 1.0, 1.0 ] ), this._gl.STATIC_DRAW );

            // Create Program

            this._currentProgram = this._createProgram( vertex_shader, fragment_shader );

            this._timeLocation = this._gl.getUniformLocation( this._currentProgram, 'time' );
            this._resolutionLocation = this._gl.getUniformLocation( this._currentProgram, 'resolution' );

            Timer.every(() => {
                this._resizeCanvas();
                this._render();
            }, 1)
        });
    }

    _resizeCanvas() {
        let canvas = this._element;
        if ( canvas.width !== canvas.clientWidth ||
            canvas.height !== canvas.clientHeight ) {

            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;

            this._parameters.screenWidth = canvas.width;
            this._parameters.screenHeight = canvas.height;

            this._gl.viewport( 0, 0, canvas.width, canvas.height );

        }
    }

    _render() {
        if ( !this._currentProgram ) return;

        this._parameters.time = new Date().getTime() - this._parameters.start_time;

        this._gl.clear( this._gl.COLOR_BUFFER_BIT | this._gl.DEPTH_BUFFER_BIT );

        // Load program into GPU

        this._gl.useProgram( this._currentProgram );

        // Set values to program variables

        this._gl.uniform1f( this._timeLocation, this._parameters.time / 1000 );
        this._gl.uniform2f( this._resolutionLocation, this._parameters.screenWidth, this._parameters.screenHeight );

        // Render geometry

        this._gl.bindBuffer( this._gl.ARRAY_BUFFER, buffer );
        this._gl.vertexAttribPointer( vertex_position, 2, this._gl.FLOAT, false, 0, 0 );
        this._gl.enableVertexAttribArray( vertex_position );
        this._gl.drawArrays( this._gl.TRIANGLES, 0, 6 );
        this._gl.disableVertexAttribArray( vertex_position );
    }

    _createProgram(vertex, fragment) {
        let program = this._gl.createProgram();


        let vs = this._createShader( vertex, this._gl.VERTEX_SHADER );
        let fs = this._createShader( '#ifdef GL_ES\nprecision highp float;\n#endif\n\n' + fragment, this._gl.FRAGMENT_SHADER );

        if ( vs === null || fs === null )
            return null;

        this._gl.attachShader( program, vs );
        this._gl.attachShader( program, fs );

        this._gl.deleteShader( vs );
        this._gl.deleteShader( fs );

        this._gl.linkProgram( program );

        if ( !this._gl.getProgramParameter( program, this._gl.LINK_STATUS ) ) {

            alert( "ERROR:\n" +
                "VALIDATE_STATUS: " + this._gl.getProgramParameter( program, this._gl.VALIDATE_STATUS ) + "\n" +
                "ERROR: " + this._gl.getError() + "\n\n" +
                "- Vertex Shader -\n" + vertex + "\n\n" +
                "- Fragment Shader -\n" + fragment );

            return null;

        }

        return program;
    }


    _createShader( src, type ) {

        let shader = this._gl.createShader( type );

        this._gl.shaderSource( shader, src );
        this._gl.compileShader( shader );

        if ( !this._gl.getShaderParameter( shader, this._gl.COMPILE_STATUS ) ) {

            alert( ( type === this._gl.VERTEX_SHADER ? "VERTEX" : "FRAGMENT" ) + " SHADER:\n" + this._gl.getShaderInfoLog( shader ) );
            return null;

        }

        return shader;

    }
}





