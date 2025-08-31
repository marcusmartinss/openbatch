import React from 'react';

function UploadModules() {
  return (
    <>
      <div className="content-box">
        <h2>Upload de Módulos</h2>
        <p>Envie módulos em formato ZIP para usar em seus jobs. Eles serão extraídos em seu diretório home.</p>
        <p>Dica: Você pode usar módulos pré-configurados como <a href="#">Python Data Science</a>, <a href="#">Bioinformatics Tools</a> ou <a href="#">Machine Learning Stack</a>.</p>
      </div>
      <div className="content-box">
        <form>
          <div className="form-group">
            <label htmlFor="module-name">Nome do Módulo</label>
            <input type="text" id="module-name" placeholder="Ex: Python ML Tools" />
          </div>
          <div className="form-group">
            <label htmlFor="module-desc">Descrição</label>
            <textarea id="module-desc" rows="3" placeholder="Descreva o que este módulo contém"></textarea>
          </div>
          <div className="form-group">
            <label htmlFor="module-file">Arquivo ZIP</label>
            <input type="file" id="module-file" />
          </div>
          <button type="submit" className="primary-btn">Enviar Módulo</button>
        </form>
      </div>
    </>
  );
}

export default UploadModules;