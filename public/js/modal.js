function openModal(url) {
    fetch(url)
        .then(response => response.text())
        .then(html => {
            let modalContainer = document.createElement("div");
            modalContainer.classList.add("modal-container");
            modalContainer.innerHTML = `
                <div class="modal-overlay">
                    <div class="modal-content">
                        ${html}
                    </div>
                </div>
            `;

            document.body.appendChild(modalContainer);

            // بستن مودال وقتی روی پس‌زمینه کلیک شد
            modalContainer.querySelector(".modal-overlay").addEventListener("click", function (e) {
                if (e.target === this) {
                    modalContainer.remove();
                }
            });

            // بستن مودال با دکمه داخل مودال
            modalContainer.querySelector(".modal-content").addEventListener("click", function (e) {
                if (e.target.classList.contains("close-modal")) {
                    modalContainer.remove();
                }
            });
        })
        .catch(error => console.error("خطا در دریافت مودال:", error));
}
