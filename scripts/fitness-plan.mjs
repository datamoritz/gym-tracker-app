// Catalog page IDs are immutable. These bootstrap mappings never depend on display names.
export const EXERCISES = [
  ['pulldown','2ddfe23d-5e3c-8033-a394-ce361eeba0f9','Pull Down','compound',['Lats'],['Biceps','Mid back'],['pulldown']],
  ['traction','2b3fe23d-5e3c-8068-bb02-c262fabe3834','Vertical Traction','compound',['Lats'],['Biceps','Mid back'],['traction']],
  ['row','3e5fe23d-5e3c-80d1-a2cc-c8088d39449e','Cable Row (seated)','compound',['Mid back','Lats'],['Biceps','Rear shoulders'],['row1','row2']],
  ['standingRow','2b3fe23d-5e3c-800d-8cd2-eb047824a926','Cable Row (standing, one arm)','compound',['Mid back','Lats'],['Biceps','Rear shoulders','Core'],['cable']],
  ['shoulder','400fe23d-5e3c-8041-a16c-c0bc4768eaae','Shoulder Press','compound',['Front shoulders'],['Triceps','Side shoulders'],['shoulder']],
  ['chest','2b3fe23d-5e3c-80f9-baa5-eb8cdf5c6e58','Chest Press','compound',['Chest'],['Triceps','Front shoulders'],['chest']],
  ['pec','401fe23d-5e3c-8057-90a6-dcd000a5a924','Chest Fly','isolation',['Chest'],['Front shoulders'],['pec']],
  ['reverse','401fe23d-5e3c-8086-b9ef-ec5a92b906ed','Reverse Pec Deck','isolation',['Rear shoulders'],['Mid back'],['pec']],
  ['fly','2b3fe23d-5e3c-8025-ae76-f0f3ab0912ac','Cable Chest Fly (low to high)','isolation',['Chest'],['Front shoulders'],['cable']],
  ['machineBiceps',null,'Biceps Curl Machine','isolation',['Biceps'],['Forearms'],['biceps']],
  ['lateral','2b3fe23d-5e3c-802f-b092-f8f679d3e372','Cable Single-Arm Lateral Raise','isolation',['Side shoulders'],['Supraspinatus','Upper trapezius'],['cable']],
  ['face','2ddfe23d-5e3c-80a8-a141-cb3184b28544','Face Pull','isolation',['Rear shoulders','Mid back'],['Rotator cuff'],['cable']],
  ['straight','2b3fe23d-5e3c-80eb-a234-d9fa33f8d4e3','Straight-Arm Cable Pulldown','isolation',['Lats'],['Triceps','Core'],['cable']],
  ['biceps','2b3fe23d-5e3c-80c7-899a-e9da014af9aa','Cable Bicep Curl','isolation',['Biceps'],['Forearms'],['cable']],
  ['machineTriceps',null,'Triceps Extension Machine','isolation',['Triceps'],[],['triceps']],
  ['triceps','2ecfe23d-5e3c-80a1-a32c-f0112354a0c3','Overhead Tricep Extension','isolation',['Triceps'],[],['cable']],
  ['legPress','2ddfe23d-5e3c-80f6-b06c-d3e0f31f3afe','Leg Press','compound',['Quads','Glutes'],['Hamstrings'],['legPress']],
  ['legCurl','2ecfe23d-5e3c-80dd-9024-e7dd07c9f247','Leg Curl','isolation',['Hamstrings'],['Calves'],['legCurl']],
  ['legExtension','2ecfe23d-5e3c-809f-b424-fdd18a8782aa','Leg Extension','isolation',['Quads'],[],['legExtension']],
  ['squat','2ecfe23d-5e3c-80c8-8f24-ee0380156e6a','Cable Goblet Squat','compound',['Quads','Glutes'],['Core'],['cable']],
  ['wood','2b3fe23d-5e3c-8014-90cb-efb60e0445e9','Wood Chopper','isolation',['Obliques','Core'],[],['cable']],
  ['dead','2ddfe23d-5e3c-8046-a801-c84383f82704','Dead Bug','isolation',['Core'],['Hip flexors'],['mat']],
  ['rearFly','2b7fe23d-5e3c-8082-9270-cdf890af5e29','Cable Rear-Delt Fly','isolation',['Rear shoulders'],['Mid back'],['cable']],
  ['crunch','2b3fe23d-5e3c-8051-8a52-e8a4130aa78d','Cable Crunch','isolation',['Core'],[],['cable']]
];
export const MACHINES = [
  ['cable1','Cable tower 1'],['cable2','Cable tower 2'],['cable3','Cable tower 3'],
  ['row1','Seated cable row 1'],['row2','Seated cable row 2'],['pulldown','Seated pulldown station'],
  ['shoulder','Shoulder press'],['chest','Chest press'],['pec','Pec deck'],['biceps','Biceps curl machine'],
  ['triceps','Triceps extension machine'],['traction','Vertical traction machine'],['legPress','Leg press'],
  ['legCurl','Leg curl machine'],['legExtension','Leg extension machine'],['mat','Floor mats']
];
// Each dose: qualifying sets, recommended sets, minimum reps, maximum reps.
export const TARGETS = [
  ['chest','Chest press',['chest'],[[2,3,8,12],[2,2,8,12]]],
  ['pull','Vertical pull',['pulldown','traction'],[[3,3,8,12],[3,3,8,12]]],
  ['row','Seated cable row',['row'],[[2,3,8,12],[2,2,8,12]]],
  ['lateral','Lateral raises',['lateral'],[[2,2,12,20],[2,2,12,20]],true],
  ['triceps','Overhead triceps extension',['triceps'],[[2,2,10,15],[2,2,10,15]]],
  ['rear','Rear delts',['reverse','rearFly'],[[2,2,12,20],[2,2,12,20]]],
  ['biceps','Biceps curls',['biceps','machineBiceps'],[[2,2,10,15],[2,2,10,15]]],
  ['shoulder','Shoulder press',['shoulder'],[[3,3,8,12]]],
  ['fly','Chest fly',['fly','pec'],[[2,2,10,15]]],
  ['straight','Straight-arm pulldown',['straight'],[[2,2,12,15]]],
  ['wood','Wood chops',['wood'],[[2,2,10,12]],true],
  ['dead','Dead bugs',['dead'],[[2,2,8,12]],true],
  ['legPress','Light leg press',['legPress'],[[2,2,10,15]]],
  ['legCurl','Seated leg curl',['legCurl'],[[2,2,10,15]]]
];
