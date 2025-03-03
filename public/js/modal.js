function openModal(url) {
    const overlay = document.getElementById('modal-overlay');
    // همیشه نمایش مودال را روی flex قرار می‌دهیم
    overlay.style.display = 'flex';
    fetch(url)
      .then(response => response.text())
      .then(data => {
          const modalContent = document.getElementById('modal-content');
          // دکمه بسته شدن در بالا سمت چپ قرار می‌گیرد
          modalContent.innerHTML = '<button class="modal-close" onclick="closeModal()">بستن</button>' + data;
          overlay.classList.add('show');
      })
      .catch(error => {
          console.error('Error loading modal content:', error);
      });
}

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('show');
    overlay.style.display = 'none';
}
