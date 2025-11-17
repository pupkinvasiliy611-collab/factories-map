document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map').setView([55.6, 38.1], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const cityFilterSelect = document.getElementById('city-filter');
    const mainFilterSelect = document.getElementById('main-product-filter');
    const secondaryFilterSelect = document.getElementById('secondary-product-filter');
    
    const markerGroup = L.layerGroup().addTo(map);
    let allFactoriesData = [];

    /* Функции форматирования (остаются без изменений) */
    function formatContacts(contactString) { /* ... код без изменений ... */ }
    function formatProductList(productString) { /* ... код без изменений ... */ }
    function createPopupContent(item) { /* ... код без изменений ... */ }

    // --- НОВАЯ, УСОВЕРШЕНСТВОВАННАЯ ЛОГИКА ФИЛЬТРАЦИИ ---

    /**
     * Центральная функция, которая запускается при любом изменении фильтров.
     * Она обновляет и доступные опции в других фильтрах, и маркеры на карте.
     */
    function updateFiltersAndMap() {
        // 1. Получаем текущие значения всех фильтров
        const selectedCity = cityFilterSelect.value;
        const selectedMain = mainFilterSelect.value;
        const selectedSecondary = secondaryFilterSelect.value;

        // 2. Фильтруем данные для обновления ОПЦИЙ в выпадающих списках
        // Для городов: учитываем фильтры продукции
        const relevantForCities = allFactoriesData.filter(item => 
            (!selectedMain || (item['Основная продукция'] && item['Основная продукция'].includes(selectedMain))) &&
            (!selectedSecondary || (item['Продукция'] && item['Продукция'].includes(selectedSecondary)))
        );
        const availableCities = getUniqueValues(relevantForCities, 'Адрес производства', true);
        populateSelectWithOptions(cityFilterSelect, availableCities, selectedCity);

        // Для основной продукции: учитываем фильтры города и остальной продукции
        const relevantForMain = allFactoriesData.filter(item => 
            (!selectedCity || (item['Адрес производства'] && item['Адрес производства'].includes(selectedCity))) &&
            (!selectedSecondary || (item['Продукция'] && item['Продукция'].includes(selectedSecondary)))
        );
        const availableMainProducts = getUniqueValues(relevantForMain, 'Основная продукция');
        populateSelectWithOptions(mainFilterSelect, availableMainProducts, selectedMain);

        // Для остальной продукции: учитываем фильтры города и основной продукции
        const relevantForSecondary = allFactoriesData.filter(item => 
            (!selectedCity || (item['Адрес производства'] && item['Адрес производства'].includes(selectedCity))) &&
            (!selectedMain || (item['Основная продукция'] && item['Основная продукция'].includes(selectedMain)))
        );
        const availableSecondaryProducts = getUniqueValues(relevantForSecondary, 'Продукция');
        populateSelectWithOptions(secondaryFilterSelect, availableSecondaryProducts, selectedSecondary);

        // 3. Фильтруем данные для отображения МАРКЕРОВ на карте (учитываем все фильтры)
        const factoriesToShow = allFactoriesData.filter(item => 
            (!selectedCity || (item['Адрес производства'] && item['Адрес производства'].includes(selectedCity))) &&
            (!selectedMain || (item['Основная продукция'] && item['Основная продукция'].includes(selectedMain))) &&
            (!selectedSecondary || (item['Продукция'] && item['Продукция'].includes(selectedSecondary)))
        );
        
        updateMapMarkers(factoriesToShow);
    }

    /**
     * Обновляет маркеры на карте на основе отфильтрованного списка заводов.
     * @param {Array} records - Массив объектов заводов для отображения.
     */
    function updateMapMarkers(records) {
        markerGroup.clearLayers();
        const visibleMarkers = [];

        records.forEach(item => {
            const lat = parseFloat(String(item["Latitude"]).replace(',', '.'));
            const lon = parseFloat(String(item["Longitude"]).replace(',', '.'));
            if (isNaN(lat) || isNaN(lon)) return;

            const marker = L.marker([lat, lon]).bindPopup(createPopupContent(item), { maxWidth: 450 });

            if (item['Наименование поставщика']) {
                marker.bindTooltip(item['Наименование поставщика'], {
                    permanent: true, direction: 'right', offset: [8, 0], className: 'factory-label'
                });
            }
            markerGroup.addLayer(marker);
            visibleMarkers.push(marker);
        });

        if (visibleMarkers.length > 0) {
            const groupBounds = L.featureGroup(visibleMarkers).getBounds();
            map.fitBounds(groupBounds.pad(0.1));
        }
    }

    /**
     * Универсальная функция для извлечения уникальных значений из данных.
     * @param {Array} records - Данные для поиска.
     * @param {string} columnName - Название колонки.
     * @param {boolean} isCity - Флаг, указывающий, что нужно искать город с помощью regex.
     * @returns {Array} - Массив уникальных отсортированных значений.
     */
    function getUniqueValues(records, columnName, isCity = false) {
        const values = new Set();
        const cityRegex = /г\.\s*([^,]+)/;

        records.forEach(item => {
            if (item[columnName]) {
                if (isCity) {
                    const match = item[columnName].match(cityRegex);
                    if (match && match[1]) values.add(match[1].trim());
                } else {
                    item[columnName].split(/\r?\n/).map(p => p.trim()).filter(p => p).forEach(p => values.add(p));
                }
            }
        });
        return Array.from(values).sort();
    }

    /**
     * Перезаполняет выпадающий список новыми опциями, сохраняя выбранное значение.
     * @param {HTMLSelectElement} selectElement - Элемент <select>.
     * @param {Array} options - Массив строк для новых <option>.
     * @param {string} selectedValue - Текущее выбранное значение, которое нужно сохранить.
     */
    function populateSelectWithOptions(selectElement, options, selectedValue) {
        const initialText = selectElement.options[0].textContent; // Сохраняем "Все города" и т.п.
        selectElement.innerHTML = `<option value="">${initialText}</option>`;
        
        options.forEach(optionValue => {
            const option = document.createElement('option');
            option.value = optionValue;
            option.textContent = optionValue;
            selectElement.appendChild(option);
        });
        
        // Восстанавливаем выбранное значение, если оно все еще доступно
        if (options.includes(selectedValue)) {
            selectElement.value = selectedValue;
        }
    }

    // --- Основная логика: загрузка и настройка событий ---
    Papa.parse('factories.csv', {
        download: true,
        header: true,
        skipEmptyLines: true,
        delimiter: ";",
        complete: function(results) {
            allFactoriesData = results.data.filter(item => item['Latitude'] && item['Longitude']);

            // Первоначальное заполнение фильтров всеми возможными вариантами
            populateSelectWithOptions(cityFilterSelect, getUniqueValues(allFactoriesData, 'Адрес производства', true), '');
            populateSelectWithOptions(mainFilterSelect, getUniqueValues(allFactoriesData, 'Основная продукция'), '');
            populateSelectWithOptions(secondaryFilterSelect, getUniqueValues(allFactoriesData, 'Продукция'), '');
            
            // Назначаем ОДИН обработчик на все фильтры
            [cityFilterSelect, mainFilterSelect, secondaryFilterSelect].forEach(select => {
                select.addEventListener('change', updateFiltersAndMap);
            });
            
            // Первоначальное отображение всех маркеров
            updateMapMarkers(allFactoriesData); 
        },
        error: function(err, file) {
            console.error("Ошибка при чтении CSV файла:", err, file);
            alert("Не удалось загрузить данные поставщиков.");
        }
    });

    /* Копируем сюда без изменений функции formatContacts, formatProductList, createPopupContent */
    function formatContacts(contactString) { if (!contactString) return ''; return contactString.split(/\r?\n/).map(line => { line = line.trim(); if (line.includes('@')) return `<a href="mailto:${line}">${line}</a>`; const phoneDigits = line.replace(/\D/g, ''); if (phoneDigits.length >= 7) return `<a href="tel:${phoneDigits}">${line}</a>`; return line; }).join('<br>'); }
    function formatProductList(productString) { if (!productString) return ''; const products = productString.split(/\r?\n/).filter(p => p.trim() !== ''); if (products.length < 2) { return productString; } const columnThreshold = 8; const listClass = products.length > columnThreshold ? 'class="product-list product-list-multicolumn"' : 'class="product-list"'; const listItems = products.map(item => `<li>${item.trim()}</li>`).join(''); return `<ul ${listClass}>${listItems}</ul>`; }
    function createPopupContent(item) { let popupContent = `<div class="company-popup">`; if (item['Наименование поставщика']) { popupContent += `<h4>${item['Наименование поставщика']}</h4><hr>`; } popupContent += `<table><tbody>`; for (const key in item) { const val = item[key]; if (!val || ['№', 'Latitude', 'Longitude', 'Наименование поставщика'].includes(key)) { continue; } let displayVal = ''; switch (key) { case 'Контактное лицо': displayVal = formatContacts(val); break; case 'Продукция': displayVal = formatProductList(val); break; case 'Сайт': if (val.toLowerCase() !== 'нет') { let url = val.trim(); if (!url.startsWith('http')) url = 'https://' + url; displayVal = `<a href="${url}" target="_blank">${val}</a>`; } else { displayVal = 'Нет'; } break; default: displayVal = String(val).replace(/\r?\n/g, '<br>'); } popupContent += `<tr><th>${key}</th><td>${displayVal}</td></tr>`; } popupContent += `</tbody></table></div>`; return popupContent; }
});