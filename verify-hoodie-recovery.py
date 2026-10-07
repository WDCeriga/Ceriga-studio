import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / 'scripts' / 'collar'))
import garment_construction_regions as segmentation

source = Path(r'C:\Users\richy\.copilot\session-state\c7eabdce-4530-4120-b556-8b1944b1f0c0\files\hoodie-regions-result.json')
garment = json.loads(source.read_text(encoding='utf-8'))
original_classify = segmentation._classify

def classify(*args, **kwargs):
    try:
        return original_classify(*args, **kwargs)
    except ValueError as error:
        print('Classification validation:', str(error), flush=True)
        raise

segmentation._classify = classify

def analyst(*args, **kwargs):
    print('Calling Astra classification only', flush=True)
    analysis = segmentation._default_analyst(*args, **kwargs)
    Path('hoodie-recovery-analysis.json').write_text(json.dumps(analysis, indent=2), encoding='utf-8')
    print('Astra reply saved', flush=True)
    return analysis

result = segmentation.segment_construction(garment, analyst=analyst)
Path('hoodie-recovered-result.json').write_text(json.dumps(result), encoding='utf-8')
construction = result['constructionRegions']
print('Regions:', [(r['id'], r['semanticType'], r['candidateIds']) for r in construction['regions']])
print('Warnings:', construction['warnings'])
for key in ('lineArtSvg', 'tracePreview', 'sourceManifest', 'sourceImage', 'cleanDrawing', 'provenance'):
    assert result.get(key) == garment.get(key), key
print('Original source/trace fields verified unchanged')
