const {mat4} = glMatrix;

document.addEventListener('DOMContentLoaded', function () {
  const canvas = document.getElementById('webgl-canvas');
  const gl = canvas.getContext('webgl');

  if (!gl) {
    console.error('Unable to initialize WebGL. Your browser may not support it.');
    return;
  }

  // Шейдеры
  // Вершинный шейдер
  const vertexShaderSource = `
  attribute vec4 a_position;
  attribute vec3 a_normal;
  uniform mat4 u_modelViewMatrix;
  uniform mat4 u_projectionMatrix;
  uniform vec3 u_lightPosition;
  varying vec3 v_normal;
  varying vec3 v_lightDirection;

  void main() {
    gl_Position = u_projectionMatrix * u_modelViewMatrix * a_position;
    v_normal = mat3(u_modelViewMatrix) * a_normal;
    vec3 lightDirection = normalize(u_lightPosition - vec3(u_modelViewMatrix * a_position));
    v_lightDirection = lightDirection;
  }
`;

  // Фрагментный шейдер
  const fragmentShaderSource = `
  precision mediump float;
  varying vec3 v_normal;
  varying vec3 v_lightDirection;

  void main() {
    vec3 normalizedNormal = normalize(v_normal);
    vec3 lightDirection = normalize(v_lightDirection);

    // Используем вектор полуфермера вместо направления света
    vec3 halfVector = normalize(normalizedNormal + lightDirection);
    
    // Добавленный код для расчета направления света относительно плоскости ZOX
    float lightIntensity = dot(normalizedNormal, halfVector);

    float intensity = max(0.0, lightIntensity);
    gl_FragColor = vec4(vec3(intensity), 1.0);
  }
`;

  // Создание сетки сферы
  const sphereVertices = [];
  const sphereNormals = [];
  const sphereIndices = [];
  const radius = 1.0;
  const latitudeBands = 150;
  const longitudeBands = 150;
  const sphereCount = 4;
  const xOffset = 6.0;
  
  for (let i = 0; i < sphereCount; i++) {
    const x = i * xOffset;
    const y = 0;
    const z = 0;
    // const color = [[0.0, 0.0, 0.0, 1.0], [0.0, 0.0, 0.0, 1.0], [0.0, 0.0, 0.0, 1.0]];
  
    for (let lat = 0; lat <= latitudeBands; lat++) {
      const theta = (lat * Math.PI) / latitudeBands;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
  
      for (let lon = 0; lon <= longitudeBands; lon++) {
        const phi = (lon * 2 * Math.PI) / longitudeBands;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);
  
        const sphereX = x + radius * cosPhi * sinTheta;
        const sphereY = y + radius * cosTheta;
        const sphereZ = z + radius * sinPhi * sinTheta;
  
        sphereVertices.push(sphereX, sphereY, sphereZ);
  
        // Нормали для освещения
        const xNormal = cosPhi * sinTheta;
        const yNormal = cosTheta;
        const zNormal = sinPhi * sinTheta;
  
        sphereNormals.push(xNormal, yNormal, zNormal);
      }
    }

    // Создание индексов для отрисовки с использованием TRIANGLE_FAN
    for (let lat = 0; lat < latitudeBands; lat++) {
      const startIndex = lat * (longitudeBands + 1);
      const nextStartIndex = (lat + 1) * (longitudeBands + 1);
  
      for (let lon = 0; lon <= longitudeBands; lon++) {
        sphereIndices.push(startIndex + lon, nextStartIndex + lon);
      }
  
      // Подключаем последнюю и первую вершины в ряду, чтобы создать замкнутый вентиль
      sphereIndices.push(startIndex, nextStartIndex);
    }
  }

  // Компиляция шейдеров
  function compileShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compilation failed:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);

  // Создание программы шейдеров
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Unable to initialize the shader program:', gl.getProgramInfoLog(program));
    return;
  }

  gl.useProgram(program);

  // Создание буфера вершин
  const positionBuffers = [];
  for (let i = 0; i < sphereCount; i++) {
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereVertices), gl.STATIC_DRAW);
    positionBuffers.push(positionBuffer);
  }

  // Создание буфера нормалей
  const normalBuffers = [];
  for (let i = 0; i < sphereCount; i++) {
    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereNormals), gl.STATIC_DRAW);
    normalBuffers.push(normalBuffer);
  } 

  // Создание буфера индексов
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(sphereIndices), gl.STATIC_DRAW);

  const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
  gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(positionAttributeLocation);

  const normalAttributeLocation = gl.getAttribLocation(program, 'a_normal');
  gl.vertexAttribPointer(normalAttributeLocation, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(normalAttributeLocation);

  const projectionMatrix = mat4.create();
  mat4.perspective(projectionMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 100.0);

  const uProjectionMatrix = gl.getUniformLocation(program, 'u_projectionMatrix');
  gl.uniformMatrix4fv(uProjectionMatrix, false, projectionMatrix);

  // const uLightDirection = gl.getUniformLocation(program, 'u_lightDirection');
  // gl.uniform3fv(uLightDirection, [360.0, -90.0, -60.0]); // направление света


  // Переменные для управления камерой
  const cameraParams = {
    eye: [0, 0, 3],
    center: [0, 0, 2],
    up: [0, 1, 0],
    translateX: 0,
    zoom: 3.0,
  };

  // Создание объекта dat.GUI
  const gui = new dat.GUI();

  // Настройка параметров камеры в dat.GUI
  const cameraFolder = gui.addFolder('Camera');
  cameraFolder.add(cameraParams, 'translateX', -25, 0).name('Translate X');
  cameraFolder.add(cameraParams, 'zoom', 0.1, 40.0).name('Zoom');
  cameraFolder.open();

  function render() {
    // Очистка canvas и отрисовка
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    const uLightPosition = gl.getUniformLocation(program, 'u_lightPosition');
    gl.uniform3fv(uLightPosition, [140.0, 70.0, -90.0]); // Позиция света  
  
    for (let i = 0; i < sphereCount; i++) {
      // Обновление буфера вершин и нормалей для каждой сферы
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffers[i]);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereVertices), gl.STATIC_DRAW);
  
      gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[i]);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereNormals), gl.STATIC_DRAW);
  
      // Обновление матрицы модели-вида в соответствии с параметрами камеры
      const modelViewMatrix = glMatrix.mat4.create();
      glMatrix.mat4.lookAt(modelViewMatrix, cameraParams.eye, cameraParams.center, cameraParams.up);
  
      mat4.translate(modelViewMatrix, modelViewMatrix, [cameraParams.translateX + i * xOffset, 0, 0]);
      mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, -cameraParams.zoom]);
  
      const uModelViewMatrix = gl.getUniformLocation(program, 'u_modelViewMatrix');
      gl.uniformMatrix4fv(uModelViewMatrix, false, modelViewMatrix);
  
      // Отрисовка сферы
      gl.drawElements(gl.TRIANGLE_STRIP, sphereIndices.length, gl.UNSIGNED_SHORT, 0);
    }
  
    requestAnimationFrame(render);
  }

  render();
});
