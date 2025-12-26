
import csv
import json
import os

def load_geojson(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def main():
    base_dir = '/Users/lucho/prj/izbori-ui/public/assets/data/geo'
    csv_path = os.path.join(base_dir, 'place_data.csv')
    geojson_path = os.path.join(base_dir, 'settlements_simplified1pct.json')
    output_path = os.path.join(base_dir, 'places.geojson')
    
    print(f"Loading GeoJSON from {geojson_path}...")
    geojson_data = load_geojson(geojson_path)
    
    feature_map = {}
    for feature in geojson_data['features']:
        props = feature.get('properties', {})
        ncode = props.get('ncode')
        if ncode:
            feature_map[ncode] = feature
            
    print(f"Loaded {len(feature_map)} features from GeoJSON.")
    
    features_out = []
    
    print(f"Processing CSV from {csv_path}...")
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter=';')
        
        matched_count = 0
        total_count = 0
        
        for row in reader:
            total_count += 1
            
            raw_ekatte = row.get('ekatte', '').strip()
            name = row.get('населено место', '').strip()
            oblast = row.get('област', '').strip()
            obshtina = row.get('община', '').strip()
            
            if not raw_ekatte:
                continue
                
            ekatte = raw_ekatte.zfill(5)
            
            if ekatte in feature_map:
                feature = feature_map[ekatte]
                geometry = feature.get('geometry')
                if geometry:
                    # Create a new feature with simplified properties
                    new_feature = {
                        "type": "Feature",
                        "geometry": geometry,
                        "properties": {
                            "ekatte": ekatte,
                            "name": name,
                            "oblast": oblast,
                            "obshtina": obshtina
                        }
                    }
                    features_out.append(new_feature)
                    matched_count += 1
            else:
                pass

    print(f"Processed {total_count} CSV rows.")
    print(f"Matched {matched_count} places with geometry.")
    
    out_collection = {
        "type": "FeatureCollection",
        "features": features_out
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(out_collection, f, ensure_ascii=False, separators=(',', ':'))
        
    print(f"Saved {len(features_out)} places to {output_path}")

if __name__ == '__main__':
    main()
