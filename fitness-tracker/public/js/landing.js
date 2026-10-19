const cube = document.getElementById('mirror-cube');
const cubeControl = document.getElementById('cube-control');
const cubeStage = document.querySelector('.cube-stage');

if (cube && cubeControl) {
    cubeControl.addEventListener('click', () => {
        const paused = cube.classList.toggle('is-paused');
        cubeControl.setAttribute('aria-label', paused ? 'Resume cube rotation' : 'Pause cube rotation');
        cubeControl.innerHTML = `<span class="control-icon">${paused ? '▶' : 'Ⅱ'}</span> ${paused ? 'Resume rotation' : 'Pause rotation'}`;
    });
}

if (cubeStage && cube) {
    cubeStage.addEventListener('pointermove', (event) => {
        if (cube.classList.contains('is-paused')) return;
        const bounds = cubeStage.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        cube.style.transform = `rotateX(${-19 - y * 8}deg) rotateY(${-34 + x * 10}deg)`;
    });

    cubeStage.addEventListener('pointerleave', () => {
        cube.style.transform = '';
    });
}
