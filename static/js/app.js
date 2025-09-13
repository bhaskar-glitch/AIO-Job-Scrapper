// Indeed Job Scraper Web Interface JavaScript

let progressInterval;
let isScraping = false;
let loadingModalShown = false;
let modalTimeout;

// DOM Elements
const searchForm = document.getElementById('searchForm');
const startBtn = document.getElementById('startBtn');
const clearBtn = document.getElementById('clearBtn');
const downloadBtn = document.getElementById('downloadBtn');
const progressSection = document.getElementById('progressSection');
const statsSection = document.getElementById('statsSection');
const resultsSection = document.getElementById('resultsSection');
const errorSection = document.getElementById('errorSection');
const loadingModal = new bootstrap.Modal(document.getElementById('loadingModal'));

// Progress elements
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const totalJobs = document.getElementById('totalJobs');
const scrapedJobs = document.getElementById('scrapedJobs');
const currentPage = document.getElementById('currentPage');
const statusText = document.getElementById('statusText');

// Results elements
const resultsTableBody = document.getElementById('resultsTableBody');
const statsCards = document.getElementById('statsCards');
const errorMessage = document.getElementById('errorMessage');

// Event Listeners
searchForm.addEventListener('submit', handleSearch);
clearBtn.addEventListener('click', clearData);
downloadBtn.addEventListener('click', downloadCSV);

// Handle search form submission
async function handleSearch(e) {
    e.preventDefault();
    
    if (isScraping) {
        showError('Scraping is already in progress. Please wait for it to complete.');
        return;
    }
    
    const formData = new FormData(searchForm);
    const searchData = {
        country: formData.get('country'),
        job_position: formData.get('job_position'),
        job_location: formData.get('job_location'),
        date_posted: formData.get('date_posted')
    };
    
    // Validate form
    if (!searchData.country) {
        showError('Please select a country.');
        return;
    }
    
    try {
        // Show loading modal
        loadingModal.show();
        loadingModalShown = true;
        
        // Set a timeout to automatically hide modal after 30 seconds as safety measure
        modalTimeout = setTimeout(() => {
            if (loadingModalShown) {
                loadingModal.hide();
                loadingModalShown = false;
                console.log('Loading modal auto-hidden after timeout');
            }
        }, 30000);
        
        // Start scraping
        const response = await fetch('/start_scraping', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(searchData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Clear the timeout since we're handling the modal properly
            if (modalTimeout) {
                clearTimeout(modalTimeout);
                modalTimeout = null;
            }
            
            // Hide loading modal after a short delay to ensure it was shown
            setTimeout(() => {
                if (loadingModalShown) {
                    loadingModal.hide();
                    loadingModalShown = false;
                }
            }, 500);
            
            startProgressMonitoring();
            showProgressSection();
            hideError();
        } else {
            // Clear timeout and hide modal on error
            if (modalTimeout) {
                clearTimeout(modalTimeout);
                modalTimeout = null;
            }
            loadingModal.hide();
            loadingModalShown = false;
            showError(result.error || 'Failed to start scraping');
        }
    } catch (error) {
        // Clear timeout and hide modal on error
        if (modalTimeout) {
            clearTimeout(modalTimeout);
            modalTimeout = null;
        }
        loadingModal.hide();
        loadingModalShown = false;
        showError('Network error: ' + error.message);
    }
}

// Start monitoring scraping progress
function startProgressMonitoring() {
    isScraping = true;
    startBtn.disabled = true;
    startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scraping...';
    
    progressInterval = setInterval(async () => {
        try {
            const response = await fetch('/scraping_status');
            const status = await response.json();
            
            updateProgress(status);
            
            if (!status.is_running) {
                clearInterval(progressInterval);
                isScraping = false;
                startBtn.disabled = false;
                startBtn.innerHTML = '<i class="fas fa-play"></i> Start Scraping';
                
                // Clear timeout and hide loading modal if it's still showing
                if (modalTimeout) {
                    clearTimeout(modalTimeout);
                    modalTimeout = null;
                }
                if (loadingModalShown) {
                    loadingModal.hide();
                    loadingModalShown = false;
                }
                
                if (status.error) {
                    showError(status.error);
                } else {
                    // Scraping completed successfully
                    await loadResults();
                }
            }
        } catch (error) {
            console.error('Error monitoring progress:', error);
        }
    }, 1000);
}

// Update progress display
function updateProgress(status) {
    const progress = status.progress || 0;
    
    progressBar.style.width = progress + '%';
    progressText.textContent = progress + '%';
    totalJobs.textContent = status.total_jobs || 0;
    scrapedJobs.textContent = status.scraped_jobs || 0;
    currentPage.textContent = status.current_page || 1;
    
    if (status.is_running) {
        statusText.textContent = 'Running';
        statusText.className = 'status-running';
    } else if (status.error) {
        statusText.textContent = 'Error';
        statusText.className = 'status-error';
    } else {
        statusText.textContent = 'Completed';
        statusText.className = 'status-completed';
    }
}

// Load and display results
async function loadResults() {
    try {
        const response = await fetch('/get_results');
        const data = await response.json();
        
        if (response.ok) {
            displayResults(data.results);
            displayStatistics(data.statistics);
            showResultsSection();
            showStatsSection();
            clearBtn.disabled = false;
            downloadBtn.disabled = false;
        } else {
            showError(data.error || 'Failed to load results');
        }
    } catch (error) {
        showError('Error loading results: ' + error.message);
    }
}

// Display job results in table
function displayResults(results) {
    resultsTableBody.innerHTML = '';
    
    results.forEach((job, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <a href="${job.Link || '#'}" target="_blank" class="job-title">
                    ${job['Job Title'] || 'N/A'}
                </a>
            </td>
            <td class="company-name">${job.Company || 'N/A'}</td>
            <td>
                <span class="location-badge">${job.Location || 'N/A'}</span>
            </td>
            <td>
                <span class="date-badge">${job['Employer Active'] || 'N/A'}</span>
            </td>
            <td>
                <a href="${job.Link || '#'}" target="_blank" class="btn btn-sm btn-outline-primary">
                    <i class="fas fa-external-link-alt"></i> View
                </a>
            </td>
        `;
        resultsTableBody.appendChild(row);
    });
}

// Display statistics
function displayStatistics(stats) {
    statsCards.innerHTML = `
        <div class="col-md-3">
            <div class="stats-card">
                <h3>${stats.total_jobs}</h3>
                <p>Total Jobs</p>
            </div>
        </div>
        <div class="col-md-3">
            <div class="stats-card">
                <h3>${stats.companies}</h3>
                <p>Companies</p>
            </div>
        </div>
        <div class="col-md-3">
            <div class="stats-card">
                <h3>${stats.locations}</h3>
                <p>Locations</p>
            </div>
        </div>
        <div class="col-md-3">
            <div class="stats-card">
                <h3>${stats.recent_jobs}</h3>
                <p>Recent Jobs</p>
            </div>
        </div>
    `;
}

// Clear all data
async function clearData() {
    try {
        const response = await fetch('/clear_data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            hideAllSections();
            clearBtn.disabled = true;
            downloadBtn.disabled = true;
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fas fa-play"></i> Start Scraping';
        } else {
            showError('Failed to clear data');
        }
    } catch (error) {
        showError('Error clearing data: ' + error.message);
    }
}

// Download CSV
function downloadCSV() {
    window.open('/download_csv', '_blank');
}

// Show/hide sections
function showProgressSection() {
    progressSection.style.display = 'block';
}

function showStatsSection() {
    statsSection.style.display = 'block';
}

function showResultsSection() {
    resultsSection.style.display = 'block';
}

function hideAllSections() {
    progressSection.style.display = 'none';
    statsSection.style.display = 'none';
    resultsSection.style.display = 'none';
    errorSection.style.display = 'none';
}

function showError(message) {
    errorMessage.textContent = message;
    errorSection.style.display = 'block';
}

function hideError() {
    errorSection.style.display = 'none';
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Set default values
    document.getElementById('country').value = 'india';
    document.getElementById('job_position').value = 'python';
    document.getElementById('job_location').value = 'remote';
    document.getElementById('date_posted').value = '10';
    
    // Hide all sections initially
    hideAllSections();
    
    // Ensure loading modal is hidden on page load
    if (loadingModalShown) {
        loadingModal.hide();
        loadingModalShown = false;
    }
});
