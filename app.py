from flask import Flask, render_template, request, jsonify, send_file
import pandas as pd
import json
import os
from datetime import datetime
from job_scraper_utils import *
import threading
import time

app = Flask(__name__)

# Global variables to store scraping status and results
scraping_status = {
    'is_running': False,
    'progress': 0,
    'total_jobs': 0,
    'scraped_jobs': 0,
    'current_page': 1,
    'error': None
}

scraped_data = None
scraping_thread = None

# Country mappings
COUNTRIES = {
    'nigeria': 'https://ng.indeed.com',
    'united_kingdom': 'https://uk.indeed.com',
    'united_states': 'https://www.indeed.com',
    'canada': 'https://ca.indeed.com',
    'germany': 'https://de.indeed.com',
    'australia': 'https://au.indeed.com',
    'south_africa': 'https://za.indeed.com',
    'sweden': 'https://se.indeed.com',
    'singapore': 'https://www.indeed.com.sg',
    'switzerland': 'https://www.indeed.ch',
    'united_arab_emirates': 'https://www.indeed.ae',
    'new_zealand': 'https://nz.indeed.com',
    'india': 'https://in.indeed.com',
    'france': 'https://www.indeed.fr',
    'italy': 'https://it.indeed.com',
    'spain': 'https://www.indeed.es',
    'japan': 'https://jp.indeed.com',
    'south_korea': 'https://kr.indeed.com',
    'brazil': 'https://www.indeed.com.br',
    'mexico': 'https://www.indeed.com.mx',
    'china': 'https://cn.indeed.com',
    'saudi_arabia': 'https://sa.indeed.com',
    'egypt': 'https://eg.indeed.com',
    'thailand': 'https://th.indeed.com',
    'vietnam': 'https://vn.indeed.com',
    'argentina': 'https://ar.indeed.com',
    'ireland': 'https://ie.indeed.com'
}

def scrape_jobs_background(country, job_position, job_location, date_posted):
    global scraping_status, scraped_data
    
    try:
        scraping_status['is_running'] = True
        scraping_status['error'] = None
        scraping_status['progress'] = 0
        scraping_status['scraped_jobs'] = 0
        scraping_status['current_page'] = 1
        
        driver = configure_webdriver()
        
        # Search for jobs
        full_url = search_jobs(driver, country, job_position, job_location, date_posted)
        
        # Update total jobs found
        if 'total_jobs' in globals():
            scraping_status['total_jobs'] = int(total_jobs.replace(',', '').replace('+', '')) if total_jobs != "Unknown" else 0
        else:
            scraping_status['total_jobs'] = 0
        
        # Scrape job data
        df = scrape_job_data(driver, country)
        
        if df.shape[0] <= 1:
            scraping_status['error'] = "No results found. Please try different search criteria."
            scraping_status['is_running'] = False
            return
        
        # Clean the data
        cleaned_df = clean_data(df)
        scraped_data = cleaned_df
        
        scraping_status['progress'] = 100
        scraping_status['scraped_jobs'] = len(cleaned_df) - 1  # Subtract 1 for header row
        scraping_status['is_running'] = False
        
    except Exception as e:
        scraping_status['error'] = str(e)
        scraping_status['is_running'] = False
    finally:
        if 'driver' in locals():
            driver.quit()

@app.route('/')
def index():
    return render_template('index.html', countries=COUNTRIES)

@app.route('/start_scraping', methods=['POST'])
def start_scraping():
    global scraping_thread
    
    if scraping_status['is_running']:
        return jsonify({'error': 'Scraping is already in progress'}), 400
    
    data = request.get_json()
    country_key = data.get('country')
    job_position = data.get('job_position', 'python')
    job_location = data.get('job_location', 'remote')
    date_posted = int(data.get('date_posted', 10))
    
    if country_key not in COUNTRIES:
        return jsonify({'error': 'Invalid country selected'}), 400
    
    country_url = COUNTRIES[country_key]
    
    # Start scraping in background thread
    scraping_thread = threading.Thread(
        target=scrape_jobs_background,
        args=(country_url, job_position, job_location, date_posted)
    )
    scraping_thread.daemon = True
    scraping_thread.start()
    
    return jsonify({'message': 'Scraping started successfully'})

@app.route('/scraping_status')
def get_scraping_status():
    return jsonify(scraping_status)

@app.route('/get_results')
def get_results():
    if scraped_data is None:
        return jsonify({'error': 'No data available'}), 404
    
    # Convert DataFrame to JSON
    results = scraped_data.to_dict('records')
    
    # Calculate statistics
    stats = {
        'total_jobs': len(results),
        'companies': scraped_data['Company'].nunique() if 'Company' in scraped_data.columns else 0,
        'locations': scraped_data['Location'].nunique() if 'Location' in scraped_data.columns else 0,
        'recent_jobs': len(scraped_data[scraped_data['Employer Active'].str.contains('day|hour|minute', case=False, na=False)]) if 'Employer Active' in scraped_data.columns else 0
    }
    
    return jsonify({
        'results': results,
        'statistics': stats
    })

@app.route('/download_csv')
def download_csv():
    if scraped_data is None:
        return jsonify({'error': 'No data available'}), 404
    
    # Create CSV file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"indeed_jobs_{timestamp}.csv"
    filepath = os.path.join('static', 'downloads', filename)
    
    # Ensure downloads directory exists
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    # Save CSV
    scraped_data.to_csv(filepath, index=False)
    
    return send_file(filepath, as_attachment=True, download_name=filename)

@app.route('/clear_data', methods=['POST'])
def clear_data():
    global scraped_data, scraping_status
    scraped_data = None
    scraping_status = {
        'is_running': False,
        'progress': 0,
        'total_jobs': 0,
        'scraped_jobs': 0,
        'current_page': 1,
        'error': None
    }
    return jsonify({'message': 'Data cleared successfully'})

if __name__ == '__main__':
    # Create necessary directories
    os.makedirs('static/downloads', exist_ok=True)
    os.makedirs('templates', exist_ok=True)
    
    app.run(debug=True, host='0.0.0.0', port=5000)
