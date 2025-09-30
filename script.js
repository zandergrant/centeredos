document.addEventListener('DOMContentLoaded', () => {
    // --- Get all the HTML elements we need ---
    const modal = document.getElementById('pulse-modal');
    const openBtn = document.getElementById('open-pulse-btn'); // For testing
    const pulseForm = document.getElementById('pulse-form');
    const skipNowBtn = document.getElementById('skip-now-btn');
    const skipTodayBtn = document.getElementById('skip-today-btn');

    // --- Function to show the modal ---
    function showModal() {
        modal.classList.remove('hidden');
    }

    // --- Function to hide the modal ---
    function hideModal() {
        modal.classList.add('hidden');
    }

    // --- Check if we should show the modal on page load ---
    // This is the logic for the 10-minute "snooze"
    const snoozeUntil = localStorage.getItem('snoozeUntil');
    const now = new Date().getTime();

    // For now, we'll just show it. We'll add the check later.
    // if (!snoozeUntil || now > snoozeUntil) {
    //    showModal(); // We'll uncomment this in a future step!
    // }

    // For testing, the button still opens the modal
    openBtn.addEventListener('click', showModal);

    // --- Event listener for the "Submit" button ---
    pulseForm.addEventListener('submit', (event) => {
        event.preventDefault(); // Prevents the page from reloading
        const formData = new FormData(pulseForm);
        const pulseData = {
            steadiness: formData.get('steadiness'),
            presence: formData.get('presence'),
            connection: formData.get('connection'),
            status: 'completed',
            submittedAt: new Date().toISOString()
        };
        
        console.log('Submitting data:', pulseData); // We'll send this to a database later
        hideModal();
    });

    // --- Event listener for the "Skip for now" button ---
    skipNowBtn.addEventListener('click', () => {
        console.log('Snoozing for 10 minutes.');
        const tenMinutesFromNow = new Date().getTime() + (10 * 60 * 1000);
        localStorage.setItem('snoozeUntil', tenMinutesFromNow);
        hideModal();
    });

    // --- Event listener for the "Skip for today" button ---
    skipTodayBtn.addEventListener('click', () => {
        console.log('Skipping for today.'); // We'll add database logic for this later
        hideModal();
    });

    // --- Logic to update the number display next to each slider ---
    const sliders = document.querySelectorAll('.slider-group input[type="range"]');
    sliders.forEach(slider => {
        const valueSpan = slider.nextElementSibling;
        slider.addEventListener('input', (event) => {
            valueSpan.textContent = event.target.value;
        });
    });
});
