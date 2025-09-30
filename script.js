document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('pulse-modal');
    const openBtn = document.getElementById('open-pulse-btn');
    
    // --- For now, this button lets us test the modal ---
    openBtn.addEventListener('click', () => {
        modal.classList.remove('hidden');
    });

    // --- Logic to update the number next to each slider ---
    const sliders = document.querySelectorAll('.slider-group input[type="range"]');
    sliders.forEach(slider => {
        const valueSpan = slider.nextElementSibling; // The <span> next to the input
        slider.addEventListener('input', (event) => {
            valueSpan.textContent = event.target.value;
        });
    });

    // We will add logic for the submit and skip buttons here later!
    // For example, to close the modal:
    // modal.classList.add('hidden');
});
