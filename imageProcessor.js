export class ImageProcessor {
    constructor(gl, state) {
        this.gl = gl;
        this.state = state;
        this.program = null;
        this.texture = null;
        this.positionBuffer = null;
        this.texCoordBuffer = null;
        this.initWebGL();
    }

    initWebGL() {
        const vertexShaderSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;
        const fragmentShaderSource = `
            precision mediump float;
            uniform sampler2D u_image;
            uniform float u_brightness;
            uniform float u_contrast;
            uniform float u_saturation;
            uniform float u_hue;
            uniform float u_exposure;
            uniform float u_highlights;
            uniform float u_shadows;
            uniform float u_blacks;
            uniform float u_whites;
            uniform float u_temperature;
            uniform float u_tint;
            uniform float u_sharpness;
            uniform float u_vignette;
            uniform float u_noise;
            uniform float u_clarity;
            uniform float u_opacity;
            uniform float u_gamma;
            uniform float u_sepia;
            uniform float u_vibrance;
            uniform float u_grayscale;
            uniform float u_invert;
            uniform bool u_showOriginal;
            varying vec2 v_texCoord;

            vec3 rgbToHsl(vec3 color) {
                float maxVal = max(max(color.r, color.g), color.b);
                float minVal = min(min(color.r, color.g), color.b);
                float h = 0.0, s = 0.0, l = (maxVal + minVal) / 2.0;
                if (maxVal != minVal) {
                    float d = maxVal - minVal;
                    s = l > 0.5 ? d / (2.0 - maxVal - minVal) : d / (maxVal + minVal);
                    if (maxVal == color.r) h = (color.g - color.b) / d + (color.g < color.b ? 6.0 : 0.0);
                    else if (maxVal == color.g) h = (color.b - color.r) / d + 2.0;
                    else h = (color.r - color.g) / d + 4.0;
                    h /= 6.0;
                }
                return vec3(h, s, l);
            }

            vec3 hslToRgb(vec3 hsl) {
                float h = hsl.x, s = hsl.y, l = hsl.z;
                vec3 rgb = vec3(l);
                if (s != 0.0) {
                    float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
                    float p = 2.0 * l - q;
                    float r = h + 1.0 / 3.0;
                    float g = h;
                    float b = h - 1.0 / 3.0;
                    rgb.r = r < 0.0 ? r + 1.0 : r > 1.0 ? r - 1.0 : r;
                    rgb.g = g < 0.0 ? g + 1.0 : g > 1.0 ? g - 1.0 : g;
                    rgb.b = b < 0.0 ? b + 1.0 : b > 1.0 ? b - 1.0 : b;
                    rgb.r = rgb.r < 1.0 / 6.0 ? p + (q - p) * 6.0 * rgb.r : rgb.r < 0.5 ? q : rgb.r < 2.0 / 3.0 ? p + (q - p) * (2.0 / 3.0 - rgb.r) * 6.0 : p;
                    rgb.g = rgb.g < 1.0 / 6.0 ? p + (q - p) * 6.0 * rgb.g : rgb.g < 0.5 ? q : rgb.g < 2.0 / 3.0 ? p + (q - p) * (2.0 / 3.0 - rgb.g) * 6.0 : p;
                    rgb.b = rgb.b < 1.0 / 6.0 ? p + (q - p) * 6.0 * rgb.b : rgb.b < 0.5 ? q : rgb.b < 2.0 / 3.0 ? p + (q - p) * (2.0 / 3.0 - rgb.b) * 6.0 : p;
                }
                return rgb;
            }

            float random(vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
            }

            void main() {
                vec4 color = texture2D(u_image, v_texCoord);

                if (!u_showOriginal) {
                    color.rgb *= u_exposure;
                    color.rgb = pow(color.rgb, vec3(1.0 / u_gamma));
                    color.rgb *= u_brightness;
                    color.rgb = (color.rgb - 0.5) * u_contrast + 0.5;

                    vec3 hsl = rgbToHsl(color.rgb);
                    hsl.y *= u_saturation;
                    hsl.x = mod(hsl.x + u_hue / 360.0, 1.0);
                    if (hsl.x < 0.0) hsl.x += 1.0;
                    color.rgb = hslToRgb(hsl);

                    float avg = (color.r + color.g + color.b) / 3.0;
                    float maxColor = max(max(color.r, color.g), color.b);
                    float amt = (maxColor - avg) * u_vibrance;
                    color.rgb += (maxColor - color.rgb) * amt;

                    float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                    if (luminance > 0.5 && luminance <= 0.75) {
                        color.rgb += u_highlights * (luminance - 0.5) * 2.0;
                    }
                    if (luminance < 0.5 && luminance >= 0.25) {
                        color.rgb += u_shadows * (0.5 - luminance) * 2.0;
                    }
                    if (luminance < 0.25) {
                        color.rgb += u_blacks * (0.25 - luminance) * 4.0;
                    }
                    if (luminance > 0.75) {
                        color.rgb += u_whites * (luminance - 0.75) * 4.0;
                    }

                    color.rgb = mix(color.rgb, (color.rgb - 0.5) * (1.0 + u_clarity) + 0.5, 0.5);
                    color.r += u_temperature * 0.2;
                    color.b -= u_temperature * 0.2;
                    color.g += u_tint * 0.2;

                    vec2 offset = vec2(0.004);
                    vec3 blurred = vec3(0.0);
                    float kernelSum = 0.0;

                    float kernel[25];
                    kernel[0] = 1.0; kernel[1] = 1.0; kernel[2] = 1.0; kernel[3] = 1.0; kernel[4] = 1.0;
                    kernel[5] = 1.0; kernel[6] = 1.0; kernel[7] = 1.0; kernel[8] = 1.0; kernel[9] = 1.0;
                    kernel[10] = 1.0; kernel[11] = 1.0; kernel[12] = 1.0; kernel[13] = 1.0; kernel[14] = 1.0;
                    kernel[15] = 1.0; kernel[16] = 1.0; kernel[17] = 1.0; kernel[18] = 1.0; kernel[19] = 1.0;
                    kernel[20] = 1.0; kernel[21] = 1.0; kernel[22] = 1.0; kernel[23] = 1.0; kernel[24] = 1.0;
                    kernelSum = 25.0;

                    blurred += texture2D(u_image, v_texCoord + vec2(-2.0 * offset.x, -2.0 * offset.y)).rgb * kernel[0];
                    blurred += texture2D(u_image, v_texCoord + vec2(-1.0 * offset.x, -2.0 * offset.y)).rgb * kernel[1];
                    blurred += texture2D(u_image, v_texCoord + vec2(0.0, -2.0 * offset.y)).rgb * kernel[2];
                    blurred += texture2D(u_image, v_texCoord + vec2(1.0 * offset.x, -2.0 * offset.y)).rgb * kernel[3];
                    blurred += texture2D(u_image, v_texCoord + vec2(2.0 * offset.x, -2.0 * offset.y)).rgb * kernel[4];
                    blurred += texture2D(u_image, v_texCoord + vec2(-2.0 * offset.x, -1.0 * offset.y)).rgb * kernel[5];
                    blurred += texture2D(u_image, v_texCoord + vec2(-1.0 * offset.x, -1.0 * offset.y)).rgb * kernel[6];
                    blurred += texture2D(u_image, v_texCoord + vec2(0.0, -1.0 * offset.y)).rgb * kernel[7];
                    blurred += texture2D(u_image, v_texCoord + vec2(1.0 * offset.x, -1.0 * offset.y)).rgb * kernel[8];
                    blurred += texture2D(u_image, v_texCoord + vec2(2.0 * offset.x, -1.0 * offset.y)).rgb * kernel[9];
                    blurred += texture2D(u_image, v_texCoord + vec2(-2.0 * offset.x, 0.0)).rgb * kernel[10];
                    blurred += texture2D(u_image, v_texCoord + vec2(-1.0 * offset.x, 0.0)).rgb * kernel[11];
                    blurred += texture2D(u_image, v_texCoord).rgb * kernel[12];
                    blurred += texture2D(u_image, v_texCoord + vec2(1.0 * offset.x, 0.0)).rgb * kernel[13];
                    blurred += texture2D(u_image, v_texCoord + vec2(2.0 * offset.x, 0.0)).rgb * kernel[14];
                    blurred += texture2D(u_image, v_texCoord + vec2(-2.0 * offset.x, 1.0 * offset.y)).rgb * kernel[15];
                    blurred += texture2D(u_image, v_texCoord + vec2(-1.0 * offset.x, 1.0 * offset.y)).rgb * kernel[16];
                    blurred += texture2D(u_image, v_texCoord + vec2(0.0, 1.0 * offset.y)).rgb * kernel[17];
                    blurred += texture2D(u_image, v_texCoord + vec2(1.0 * offset.x, 1.0 * offset.y)).rgb * kernel[18];
                    blurred += texture2D(u_image, v_texCoord + vec2(2.0 * offset.x, 1.0 * offset.y)).rgb * kernel[19];
                    blurred += texture2D(u_image, v_texCoord + vec2(-2.0 * offset.x, 2.0 * offset.y)).rgb * kernel[20];
                    blurred += texture2D(u_image, v_texCoord + vec2(-1.0 * offset.x, 2.0 * offset.y)).rgb * kernel[21];
                    blurred += texture2D(u_image, v_texCoord + vec2(0.0, 2.0 * offset.y)).rgb * kernel[22];
                    blurred += texture2D(u_image, v_texCoord + vec2(1.0 * offset.x, 2.0 * offset.y)).rgb * kernel[23];
                    blurred += texture2D(u_image, v_texCoord + vec2(2.0 * offset.x, 2.0 * offset.y)).rgb * kernel[24];

                    blurred /= kernelSum;
                    vec3 highFreq = color.rgb - blurred;
                    color.rgb += highFreq * u_sharpness;

                    vec2 uv = v_texCoord - 0.5;
                    float dist = length(uv);
                    color.rgb *= 1.0 - u_vignette * smoothstep(0.3, 0.7, dist);

                    float noiseVal = random(v_texCoord + vec2(u_noise * 1000.0)) * u_noise;
                    color.rgb += vec3(noiseVal) * 0.2;

                    vec3 sepiaColor = vec3(
                        dot(color.rgb, vec3(0.393, 0.769, 0.189)),
                        dot(color.rgb, vec3(0.349, 0.686, 0.168)),
                        dot(color.rgb, vec3(0.272, 0.534, 0.131))
                    );
                    color.rgb = mix(color.rgb, sepiaColor, u_sepia);

                    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                    color.rgb = mix(color.rgb, vec3(gray), u_grayscale);
                    color.rgb = mix(color.rgb, 1.0 - color.rgb, u_invert);
                    color.a *= u_opacity;
                }

                gl_FragColor = clamp(color, 0.0, 1.0);
            }
        `;

        const vertexShader = this.compileShader(vertexShaderSource, this.gl.VERTEX_SHADER);
        const fragmentShader = this.compileShader(fragmentShaderSource, this.gl.FRAGMENT_SHADER);

        this.program = this.gl.createProgram();
        this.gl.attachShader(this.program, vertexShader);
        this.gl.attachShader(this.program, fragmentShader);
        this.gl.linkProgram(this.program);

        this.positionBuffer = this.gl.createBuffer();
        this.texCoordBuffer = this.gl.createBuffer();

        this.texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    }

    compileShader(source, type) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    setImage(img) {
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, img);
        this.state.image = img;
        if (!this.state.originalImage) {
            this.state.originalImage = img;
            this.state.aspectRatio = img.width / img.height;
        }
    }

    render() {
        if (!this.texture || !this.state.image) return;

        const positions = new Float32Array([
            -1.0,  1.0,
             1.0,  1.0,
            -1.0, -1.0,
             1.0, -1.0
        ]);

        const texCoords = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);

        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.clearColor(0, 0, 0, 1);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        this.gl.useProgram(this.program);

        const positionLoc = this.gl.getAttribLocation(this.program, 'a_position');
        this.gl.enableVertexAttribArray(positionLoc);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
        this.gl.vertexAttribPointer(positionLoc, 2, this.gl.FLOAT, false, 0, 0);

        const texCoordLoc = this.gl.getAttribLocation(this.program, 'a_texCoord');
        this.gl.enableVertexAttribArray(texCoordLoc);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, texCoords, this.gl.STATIC_DRAW);
        this.gl.vertexAttribPointer(texCoordLoc, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_brightness'), this.state.adjustments.brightness);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_contrast'), this.state.adjustments.contrast);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_saturation'), this.state.adjustments.saturation);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_hue'), this.state.adjustments.hue);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_exposure'), this.state.adjustments.exposure);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_highlights'), this.state.adjustments.highlights);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_shadows'), this.state.adjustments.shadows);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_blacks'), this.state.adjustments.blacks);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_whites'), this.state.adjustments.whites);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_temperature'), this.state.adjustments.temperature);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_tint'), this.state.adjustments.tint);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_sharpness'), this.state.adjustments.sharpness);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_vignette'), this.state.adjustments.vignette);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_noise'), this.state.adjustments.noise);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_clarity'), this.state.adjustments.clarity);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_opacity'), this.state.adjustments.opacity);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_gamma'), this.state.adjustments.gamma);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_sepia'), this.state.adjustments.sepia);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_vibrance'), this.state.adjustments.vibrance);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_grayscale'), this.state.adjustments.grayscale);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_invert'), this.state.adjustments.invert);
        this.gl.uniform1i(this.gl.getUniformLocation(this.program, 'u_showOriginal'), this.state.showOriginal ? 1 : 0);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.uniform1i(this.gl.getUniformLocation(this.program, 'u_image'), 0);

        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }
}