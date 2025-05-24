function upgradeTables() {
    var tableIds = [];
    var tableInnerHTMLs = [];
    document.querySelectorAll("table").forEach(table => {
        if (getComputedStyle(table).display === "none") return; // Skip hidden tables
        if (table.querySelector("thead")) return; // Skip if already has thead

        let tbody = table.querySelector("tbody");
        if (!tbody) return; // Ensure tbody exists

        let firstRow = tbody.querySelector("tr");
        if (!firstRow) return; // Ensure there's at least one row

        let thead = document.createElement("thead");
        thead.appendChild(firstRow); // Move the first row to thead
        table.id = generateRandomString(10);
        table.classList.add('ui', 'celled', 'table', 'striped');
        tableIds.push(table.id);
        table.insertBefore(thead, tbody); // Insert thead before tbody

        table.querySelectorAll("col, colgroup").forEach(col => col.remove());

        tableInnerHTMLs.push(table.innerHTML); // Store the innerHTML of the table
    });
    document.querySelectorAll("td").forEach(r => {
        //remode hard coded style
        r.style = '';
    });
    return {tableIds:tableIds,tableInnerHTMLs:tableInnerHTMLs};
}