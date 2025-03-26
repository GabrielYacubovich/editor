// imageProcessor.js
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
            uniform float u_rgbSplit;
            uniform float u_filmGrain;
            uniform float u_waveDistortion;
            uniform float u_blockGlitch;
            uniform float u_ghosting;
            uniform float u_fractalDistortion;
            uniform float u_colorShift;
            uniform float u_pixelNoise;
            uniform float u_scratchTexture;
            uniform float u_organicDistortion;
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

            float noise(vec2 st) {
                vec2 i = floor(st);
                vec2 f = fract(st);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(mix(random(i + vec2(0.0, 0.0)), random(i + vec2(1.0, 0.0)), u.x),
                          mix(random(i + vec2(0.0, 1.0)), random(i + vec2(1.0, 1.0)), u.x), u.y);
            }

            void main() {
                vec2 uv = v_texCoord;
                vec4 color = vec4(0.0);

                if (!u_showOriginal) {
                    // Apply distortion effects
                    vec2 distortedUV = uv;

                    // Wave Distortion
                    if (u_waveDistortion > 0.0) {
                        distortedUV.x += sin(distortedUV.y * 10.0) * u_waveDistortion * 0.05;
                        distortedUV.y += cos(distortedUV.x * 10.0) * u_waveDistortion * 0.05;
                    }

                    // Fractal Distortion
                    if (u_fractalDistortion > 0.0) {
                        float n = noise(distortedUV * 5.0);
                        distortedUV += vec2(sin(n * 10.0), cos(n * 10.0)) * u_fractalDistortion * 0.05;
                    }

                    // Organic Distortion
                    if (u_organicDistortion > 0.0) {
                        float n1 = noise(distortedUV * 3.0 + vec2(0.5));
                        float n2 = noise(distortedUV * 3.0 + vec2(-0.5));
                        distortedUV.x += sin(n1 * 6.0) * u_organicDistortion * 0.03;
                        distortedUV.y += cos(n2 * 6.0) * u_organicDistortion * 0.03;
                    }

                    // Base color
                    vec4 baseColor = texture2D(u_image, distortedUV);

                    // RGB Split
                    if (u_rgbSplit > 0.0) {
                        vec2 offset = vec2(u_rgbSplit, 0.0);
                        color.r = texture2D(u_image, distortedUV + offset).r;
                        color.g = baseColor.g;
                        color.b = texture2D(u_image, distortedUV - offset).b;
                        color.a = baseColor.a;
                    } else {
                        color = baseColor;
                    }

                    // Basic adjustments
                    color.rgb *= u_exposure;
                    color.rgb = pow(color.rgb, vec3(1.0 / u_gamma));
                    color.rgb *= u_brightness;
                    color.rgb = (color.rgb - 0.5) * u_contrast + 0.5;

                    vec3 hsl = rgbToHsl(color.rgb);
                    hsl.y *= u_saturation;
                    hsl.x = mod(hsl.x + u_hue / 360.0, 1.0);
                    if (hsl.x < 0.0) hsl.x += 1.0;
                    color.rgb = hslToRgb(hsl);

                    // Other adjustments
                    float avg = (color.r + color.g + color.b) / 3.0;
                    float maxColor = max(max(color.r, color.g), color.b);
                    float amt = (maxColor - avg) * abs(u_vibrance);
                    color.rgb += (maxColor - color.rgb) * (u_vibrance > 0.0 ? amt : -amt);

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

                    // Sharpness & Clarity
                    vec2 offset = vec2(0.004);
                    vec3 blurred = texture2D(u_image, distortedUV).rgb;
                    color.rgb += (color.rgb - blurred) * u_sharpness;
                    color.rgb = mix(color.rgb, (color.rgb - 0.5) * (1.0 + u_clarity) + 0.5, 0.5);

                    // Temperature & Tint
                    color.r += u_temperature * 0.2;
                    color.b -= u_temperature * 0.2;
                    color.g += u_tint * 0.2;

                    // Film Grain
                    if (u_filmGrain > 0.0) {
                        float grain = noise(uv * 1000.0) * u_filmGrain * 0.2;
                        color.rgb += vec3(grain);
                    }

                    // Block Glitch
                    if (u_blockGlitch > 0.0) {
                        float block = floor(random(floor(uv * 50.0)) * u_blockGlitch * 10.0);
                        if (block > 0.5) {
                            color.rgb = texture2D(u_image, uv + vec2(block * 0.1, 0.0)).rgb;
                        }
                    }

                    // Color Shift
                    if (u_colorShift > 0.0) {
                        vec3 shift = vec3(
                            sin(uv.x * 10.0) * u_colorShift,
                            cos(uv.y * 10.0) * u_colorShift,
                            sin(uv.x * uv.y * 10.0) * u_colorShift
                        );
                        color.rgb += shift * 0.2;
                    }

                    // Ghosting
                    if (u_ghosting > 0.0) {
                        vec4 ghost = texture2D(u_image, uv + vec2(u_ghosting * 0.1, 0.0));
                        color.rgb = mix(color.rgb, ghost.rgb, u_ghosting);
                    }

                    // Pixel Noise
                    if (u_pixelNoise > 0.0) {
                        vec3 noiseColor = vec3(
                            random(uv * 1000.0),
                            random(uv * 1000.0 + vec2(1.0)),
                            random(uv * 1000.0 + vec2(2.0))
                        );
                        color.rgb += noiseColor * u_pixelNoise * 0.3;
                    }

                    // Scratch Texture
                    if (u_scratchTexture > 0.0) {
                        float scratch = noise(vec2(uv.x * 2.0, uv.y * 100.0));
                        if (scratch > 0.9 - u_scratchTexture * 0.5) {
                            color.rgb += vec3(0.8) * u_scratchTexture;
                        }
                    }

                    // Final effects
                    vec2 center = uv - 0.5;
                    float dist = length(center);
                    color.rgb *= 1.0 - u_vignette * smoothstep(0.3, 0.7, dist);

                    float noiseVal = random(uv + vec2(u_noise * 1000.0)) * u_noise;
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
                } else {
                    color = texture2D(u_image, uv);
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
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_rgbSplit'), this.state.adjustments.rgbSplit);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_filmGrain'), this.state.adjustments.filmGrain);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_waveDistortion'), this.state.adjustments.waveDistortion);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_blockGlitch'), this.state.adjustments.blockGlitch);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_ghosting'), this.state.adjustments.ghosting);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_fractalDistortion'), this.state.adjustments.fractalDistortion);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_colorShift'), this.state.adjustments.colorShift);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_pixelNoise'), this.state.adjustments.pixelNoise);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_scratchTexture'), this.state.adjustments.scratchTexture);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'u_organicDistortion'), this.state.adjustments.organicDistortion);
        this.gl.uniform1i(this.gl.getUniformLocation(this.program, 'u_showOriginal'), this.state.showOriginal ? 1 : 0);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.uniform1i(this.gl.getUniformLocation(this.program, 'u_image'), 0);

        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }
}