
function formatearFecha(fecha) {
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  const partes = fecha.split('-');
  const dia = parseInt(partes[0], 10);
  const mes = meses[parseInt(partes[1], 10) - 1];
  const anio = partes[2];

  return `${dia} de ${mes} de ${anio}`;
}

function construirSeAdjunta(fotos, videos) {
  let resultado = "Se adjunta:\n\n";
  if (fotos > 0) {
    resultado += `\t(X) ${fotos} fotografía${fotos > 1 ? 's' : ''}\n`;
  }
  if (videos > 0) {
    resultado += `\t(X) ${videos} video${videos > 1 ? 's' : ''}\n`;
  }

  return fotos > 0 || videos > 0 ? resultado : ""; // Devuelve vacío si no hay fotos ni videos
}

function pegarImagenes(imagenesFolder,placa, body, bodyWidth) {

  const subfolders = imagenesFolder.getFoldersByName(placa);
  
  if (subfolders.hasNext()) {
    const subfolder = subfolders.next();    
    var files = subfolder.getFiles();
    let hayImagenes = false

    while (files.hasNext()) {
      const file = files.next();
      if (file.getMimeType().startsWith('image/') && file.getName().split('.').slice(0, -1).join('.').endsWith("_timestamp")) {
        // Logger.log("Encontró imagen tipo _timestamp")
        const image = body.appendImage(file.getBlob());

        const originalWidth = image.getWidth();
        const originalHeight = image.getHeight();

        // Nuevo alto proporcional
        const scaleFactor = bodyWidth / originalWidth; // Escala
        const newHeight = originalHeight * scaleFactor;

        image.setWidth(bodyWidth).setHeight(newHeight);

        body.appendParagraph('');
        hayImagenes = true;
        
      }
    }
    if (hayImagenes){
      Logger.log('Imágenes creadas para ' + placa);
    }
      
  } else {
    Logger.log('No se encontró carpeta para ' + placa);
  }
}

function ponerTimestampEnImagenes(subfoldersImagenesList,timestamp,placa){

  const cloudRunUrl = 'https://add-timestamp-685322027228.us-central1.run.app'

  const subfolder = subfoldersImagenesList.find(folder => folder.getName() === placa);
  
  if (subfolder) {
    const subfolderId = subfolder.getId();
    
    const payload = {
      folder_id: subfolderId,
      timestamp: timestamp,
    };
    Logger.log(payload);

    const options = {
      method: "post",
      contentType: "application/x-www-form-urlencoded",
      payload: payload,
    };

    try {
      const response = UrlFetchApp.fetch(cloudRunUrl, options);
      Logger.log("Respuesta del servidor: " + response.getContentText());
    } catch (error) {
      Logger.log("Error al llamar a Cloud Run: " + error);
    }
  }

}

function generarImagenes(){
  
  const hojaId = '1_XUqnPDwKxSED6Vliag_CpAEifrbs-sL20NIKQSLO80'
  const imagenesFolderId = '1FemCpPt-XB7cIU1ZH4QQCzAM3ciqEyqs'

  const spreadsheet = SpreadsheetApp.openById(hojaId);
  const sheet = spreadsheet.getSheets()[0];
  const data = sheet.getDataRange().getValues();

  const imagenesFolder = DriveApp.getFolderById(imagenesFolderId);

  const observacionesColIndex = 10; // Índice de la columna "Observaciones" (J)
  for (let i = 1; i < data.length; i++) {
    sheet.getRange(i + 1, observacionesColIndex + 1).setValue("");
  }

  // Almacenamos los subfolders de las imágenes por cada placa en una lista, para no llamar cada vez a getFolders y consumir la API innecesariamente al reiniciar el puntero por cada iteración
  const subfoldersImagenesList = [];
  const subfoldersImagenes = imagenesFolder.getFolders();
  while (subfoldersImagenes.hasNext()) {
    subfoldersImagenesList.push(subfoldersImagenes.next());
  } 

  for (let i = 1; i < data.length; i++) { 
    let observacion = "Imagen generada"; 
    try{
      const fechaInfraccionV0 = data[i][0]
      const hora = data[i][4]
      const placa = data[i][5]
      Logger.log("Placa: "+placa)
      
      const fechaInfraccionV1 = Utilities.formatDate(fechaInfraccionV0, Session.getScriptTimeZone(), 'dd-MM-yyyy')
      const timestamp = `${fechaInfraccionV1} ${hora}:00` 
      ponerTimestampEnImagenes(subfoldersImagenesList,timestamp,placa)
      
    }catch(error){
      observacion = `Error: ${error.message}`;
    } finally {
      sheet.getRange(i + 1, observacionesColIndex + 1).setValue(observacion);
    }
  }
}

function generarPapeletasConImagenes() {
  // const folderId = '1srdc4JrwsFXkCAUTbapOm7D7CzNi_86x'; // Folder de papeletas
  const folderId = '1CfpLtSv_3fW3ABZzSgt8whrqJhmB6vWu' // Folder nuevo de papeletas
  const plantillaDocsId = '1rA4aDFlT6RpYqigF2mbOaT9M-A8d2camp2Lmx8ErW-Y'; // ID del documento de Google Docs (plantilla)
  const hojaId = '1_XUqnPDwKxSED6Vliag_CpAEifrbs-sL20NIKQSLO80'; // ID del archivo de Google Sheets
  const imagenesFolderId = '1FemCpPt-XB7cIU1ZH4QQCzAM3ciqEyqs' //oficial - ID de la carpeta donde están las imágenes
  // const imagenesFolderId = '198WJ4spugEGZflp7GWsBxrdtdTkGsCZu'; // prueba - ID de la carpeta donde están las imágenes
  
  const spreadsheet = SpreadsheetApp.openById(hojaId);
  const sheet = spreadsheet.getSheets()[0]; // esto coge la primera hoja
  const data = sheet.getDataRange().getValues(); // esto coge todo el rango activo (algo como de A1:F10)

  const folder = DriveApp.getFolderById(folderId);
  const plantilla = DriveApp.getFileById(plantillaDocsId);
  const imagenesFolder = DriveApp.getFolderById(imagenesFolderId);
  // const subfoldersImagenes = imagenesFolder.getFolders()

  const observacionesColIndex = 9; // Índice de la columna "Observaciones" (J)
  for (let i = 1; i < data.length; i++) {
    sheet.getRange(i + 1, observacionesColIndex + 1).setValue("");
  }

  for (let i = 1; i < data.length; i++) { // empezar en i=1 salta el encabezado
    let observacion = "Ejecutado exitosamente"; 
    Logger.log("-------------------------------------------------------")
    try{

      const [fechaInfraccionV0, km, distrito, sentido, hora, placa, nombre, foto, video] = data[i]; // desempaca el data en sus componentes
      const fechaInfraccionV1 = Utilities.formatDate(fechaInfraccionV0, Session.getScriptTimeZone(), 'dd-MM-yyyy') // 19/01/2025
      const fechaInfraccion = formatearFecha(fechaInfraccionV1); // 19 de enero de 2025
      
      Logger.log("Inicia proceso para placa "+ placa)
      // Validar si ya existiera el archivo, sino para eliminarlo
      const fileName = `${fechaInfraccionV1} - PAPELETA ${placa}`
      const filesPapeletasExistentes = folder.getFilesByName(fileName);

      while (filesPapeletasExistentes.hasNext()){
        const archivoExistente = filesPapeletasExistentes.next();
        archivoExistente.setTrashed(true);
      }

      // Lo crea habiendo validado si existe o no
      const nuevoDocumento = plantilla.makeCopy(fileName, folder);
      const doc = DocumentApp.openById(nuevoDocumento.getId());
      const body = doc.getBody();
      const bodyWidth = doc.getPageWidth() - doc.getMarginLeft() - doc.getMarginRight();
      const fechaActual = new Date();

      body.replaceText('\\[PLACA\\]', placa);
      body.replaceText('\\[FECHA_INFRACCION\\]', fechaInfraccion);
      body.replaceText('\\[DISTRITO\\]', distrito);
      body.replaceText('\\[HORA\\]', hora);
      body.replaceText('\\[KM\\]', km);
      body.replaceText('\\[SENTIDO\\]', sentido.toLocaleString().toLowerCase());
      body.replaceText('\\[NOMBRE_PROPIETARIO\\]', nombre);
      body.replaceText('\\[FECHA_DENUNCIA\\]', formatearFecha(Utilities.formatDate(fechaActual, Session.getScriptTimeZone(), 'dd-MM-yyyy')));
      body.replaceText('\\[SE_ADJUNTA\\]',construirSeAdjunta(foto, video))

      const imagenesFolder = DriveApp.getFolderById(imagenesFolderId);
      pegarImagenes(imagenesFolder,placa, body, bodyWidth)
      
      doc.saveAndClose();
      
    } catch(error){
      observacion = `Error: ${error.message}`;
    } finally {
      sheet.getRange(i + 1, observacionesColIndex + 1).setValue(observacion);
    }

  }
}