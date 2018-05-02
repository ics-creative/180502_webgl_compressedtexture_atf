import {mat4} from 'gl-matrix';
import EventName from './enum/EventName';
import {RoundCameraController} from './myLib/webgl/controller/RoundCameraController';
import {Camera} from './myLib/webgl/engine/Camera';
import {ShaderObject} from './myLib/webgl/engine/ShaderObject';
import {SceneObject} from './myLib/webgl/object/SceneObject';
import {Plane} from './myLib/webgl/primitive/Plane';
import {Primitive} from './myLib/webgl/primitive/Primitive';
import {AlphaTexturingShader} from './project/AlphaTexturingShader';
import {ATF, ATFCompressedTextureData} from './project/ATF';
import {CompressedTexture} from './project/CompressedTexture';
import {SimpleTexturingShader} from './project/SimpleTexturingShader';

class Main
{
  private static COMPRESSED_TEXTURE_FORMAT_MAP:any = {
    // WEBGL_compressed_texture_s3tc
    0x83F0:'COMPRESSED_RGB_S3TC_DXT1_EXT',
    0x83F1:'COMPRESSED_RGBA_S3TC_DXT1_EXT',
    0x83F2:'COMPRESSED_RGBA_S3TC_DXT3_EXT',
    0x83F3:'COMPRESSED_RGBA_S3TC_DXT5_EXT',
    // WEBGL_compressed_texture_pvrtc
    0x8C00:'COMPRESSED_RGB_PVRTC_4BPPV1_IMG',
    0x8C02:'COMPRESSED_RGBA_PVRTC_4BPPV1_IMG',
    0x8C01:'COMPRESSED_RGB_PVRTC_2BPPV1_IMG',
    0x8C03:'COMPRESSED_RGBA_PVRTC_2BPPV1_IMG',
    // WEBGL_compressed_texture_etc1
    0x8D64:'COMPRESSED_RGB_ETC1_WEBGL'
  };

  private static RAD:number = Math.PI / 180;

  private static CANVAS_WIDTH:number = 960;
  private static CANVAS_HEIGHT:number = 540;

  private stats:Stats;

  private canvas:HTMLCanvasElement;
  private context:WebGLRenderingContext;
  private supportedCompressedTextureFormat:Uint32Array;
  private extS3TC:WebGLCompressedTextureS3TC;
  private extPVRTC:WebGLCompressedTexturePVRTC;
  private extETC1:WebGLCompressedTextureETC1;

  private controller:RoundCameraController;
  private camera:Camera;
  private scene:SceneObject[];
  private alphaScene:SceneObject[];

  constructor()
  {
    console.log(new Date());
    console.log(navigator.userAgent);

    this.canvas = <HTMLCanvasElement> document.getElementById(('myCanvas'));
    this.canvas.width = Main.CANVAS_WIDTH;
    this.canvas.height = Main.CANVAS_HEIGHT;
    this.context = (<WebGLRenderingContext> this.canvas.getContext('webgl') || <WebGLRenderingContext> this.canvas.getContext('experimental-webgl'));

    this.extS3TC = (
      this.context.getExtension('WEBGL_compressed_texture_s3tc') ||
      this.context.getExtension('WEBKIT_WEBGL_compressed_texture_s3tc')
    );
    this.addText('S3TC support: ' + (this.extS3TC !== null));

    this.extPVRTC = (
      this.context.getExtension('WEBGL_compressed_texture_pvrtc') ||
      this.context.getExtension('WEBKIT_WEBGL_compressed_texture_pvrtc')
    );
    this.addText('PVRTC support: ' + (this.extPVRTC !== null));

    this.extETC1 = (
      this.context.getExtension('WEBGL_compressed_texture_etc1') ||
      this.context.getExtension('WEBKIT_WEBGL_compressed_texture_etc1')
    );
    this.addText('ETC1 support: ' + (this.extETC1 !== null));

    this.supportedCompressedTextureFormat = this.context.getParameter(this.context.COMPRESSED_TEXTURE_FORMATS);
    let supportedFormatStr:string = '';
    const length:number = this.supportedCompressedTextureFormat.length;
    for(let i:number = 0; i < length; i++)
    {
      if(i === 0)
      {
        supportedFormatStr += '\n';
      }
      supportedFormatStr += Main.COMPRESSED_TEXTURE_FORMAT_MAP[this.supportedCompressedTextureFormat[i]] + '\n';
    }
    this.addText('supported formats: [' + supportedFormatStr + ']');

    this.addText('--------------------');
    const webgl2:any = document.createElement('canvas').getContext('webgl2');
    this.addText('WebGL 2.0 support: ' + (webgl2 !== null));
    if(webgl2)
    {
      const extETC2:any = (
        webgl2.getExtension('WEBGL_compressed_texture_etc') ||
        webgl2.getExtension('WEBKIT_WEBGL_compressed_texture_etc')
      );
      this.addText('ETC2 support: ' + (extETC2 !== null && webgl2.getParameter(this.context.COMPRESSED_TEXTURE_FORMATS).includes(0x9274)));
    }

    // Stats
    this.stats = new Stats();
    document.body.appendChild(this.stats.dom);

    // initialize context
    this.context.clearColor(0.0, 0.0, 0.0, 1.0);
    this.context.clearDepth(1.0);
    // this.context.enable(this.context.CULL_FACE);
    this.context.frontFace(this.context.CCW);
    this.context.enable(this.context.DEPTH_TEST);
    this.context.depthFunc(this.context.LEQUAL);
    this.context.enable(this.context.BLEND);
    this.context.blendFunc(this.context.SRC_ALPHA, this.context.ONE_MINUS_SRC_ALPHA);

    // initialize camera
    this.camera = new Camera(60 * Main.RAD, Main.CANVAS_WIDTH / Main.CANVAS_HEIGHT, 0.1, 1000.0);
    this.controller = new RoundCameraController(this.camera, this.canvas);
    this.canvas.style.cursor = 'move';
    this.controller.radius = 80;
    this.controller.radiusOffset = 1;
    this.controller.rotate(0, 0);

    // initialize scene
    this.scene = [];
    this.alphaScene = [];

    this.render();

    // load ATF file and add Plane
    this.addATFPlane('js/assets/compressed.atf', 0, 0, 0);
    this.addATFPlane('js/assets/alpha.atf', 30, 30, 30);
  }

  private addATFPlane(filePath:string, x:number, y:number, z:number):Promise<void>
  {
    return fetch(filePath).then((response:Response) =>
    {
      return response.arrayBuffer();
    }).then((arrayBuffer:ArrayBuffer) =>
    {
      const data:Uint8Array = new Uint8Array(arrayBuffer);
      this.readComplete(new ATF(data), x, y, z);
    });
  }

  private readComplete(atf:ATF, x:number, y:number, z:number):void
  {
    // select valid compressed texture format to ATF data and GPU
    let textureData:ATFCompressedTextureData;
    if(atf.dxtData && this.extS3TC && this.supportedCompressedTextureFormat.includes(atf.dxtData.internalformat))
    {
      textureData = atf.dxtData;
    }
    else if(atf.pvrtcData && this.extPVRTC && this.supportedCompressedTextureFormat.includes(atf.pvrtcData.internalformat))
    {
      textureData = atf.pvrtcData;
    }
    else if(atf.etc1Data && this.extETC1 && this.supportedCompressedTextureFormat.includes(atf.etc1Data.internalformat))
    {
      textureData = atf.etc1Data;
    }
    else
    {
      return;
    }

    // craete Plane
    const plane:Plane = new Plane(this.context, 8, 8, 10, 10, (Primitive.ATTRIBUTE_USE_POSITION | Primitive.ATTRIBUTE_USE_UV));
    plane.scaleX = 8.0;
    plane.scaleY = -8.0;
    plane.x = x;
    plane.y = y;
    plane.z = z;
    if(textureData.useAlpha)
    {
      this.alphaScene.push(plane);
    }
    else
    {
      this.scene.push(plane);
    }

    let textureShader:ShaderObject;
    if(textureData.alphaDataList)
    {
      textureShader = new AlphaTexturingShader(this.context);
    }
    else
    {
      textureShader = new SimpleTexturingShader(this.context);
    }
    plane.attachShader(textureShader);

    const texture:CompressedTexture = new CompressedTexture(this.context);
    texture.setCompressedImage(textureData.dataList, textureData.internalformat, atf.width, atf.height);
    (<SimpleTexturingShader> plane.shader).texture = texture;

    if(textureData.alphaDataList)
    {
      const alphaTexture:CompressedTexture = new CompressedTexture(this.context);
      alphaTexture.setCompressedImage(textureData.alphaDataList, textureData.internalformat, atf.width, atf.height);
      (<AlphaTexturingShader> plane.shader).alphaTexture = alphaTexture;
    }
  }

  private render():void
  {
    this.stats.begin();

    // update camera
    this.controller.upDate(0.1);
    const mMatrix:mat4 = mat4.identity(mat4.create());
    const mvpMatrix:mat4 = mat4.identity(mat4.create());
    mat4.multiply(mvpMatrix, this.camera.getCameraMtx(), mMatrix);
    const cameraMatrix:mat4 = this.camera.getCameraMtx();

    this.context.clear(this.context.COLOR_BUFFER_BIT | this.context.DEPTH_BUFFER_BIT);

    // render opaque objects
    this.context.depthMask(true);
    this.context.disable(this.context.BLEND);

    const length:number = this.scene.length;
    for(let i:number = 0; i < length; i++)
    {
      let obj:SceneObject = this.scene[i];
      if(obj)
      {
        const objMMatrix:mat4 = obj.getModelMtx();
        const objectMVPMatrix:mat4 = mat4.create();
        mat4.multiply(objectMVPMatrix, cameraMatrix, objMMatrix);
        obj.shader.getUniform('mvpMatrix').matrix = objectMVPMatrix;
        obj.shader.bindShader();
        obj.bindVertexbuffer();
        obj.bindIndexbuffer();
        this.context.drawElements(this.context.TRIANGLES, obj.iboData.length, this.context.UNSIGNED_SHORT, 0);
      }
    }

    // render transparent objects
    this.context.depthMask(false);
    this.context.enable(this.context.BLEND);

    const alphaLength:number = this.alphaScene.length;
    for(let i:number = 0; i < alphaLength; i++)
    {
      let obj:SceneObject = this.alphaScene[i];
      if(obj)
      {
        const objMMatrix:mat4 = obj.getModelMtx();
        const objectMVPMatrix:mat4 = mat4.create();
        mat4.multiply(objectMVPMatrix, cameraMatrix, objMMatrix);
        obj.shader.getUniform('mvpMatrix').matrix = objectMVPMatrix;
        obj.shader.bindShader();
        obj.bindVertexbuffer();
        obj.bindIndexbuffer();
        this.context.drawElements(this.context.TRIANGLES, obj.iboData.length, this.context.UNSIGNED_SHORT, 0);
      }
    }

    this.context.flush();

    this.stats.end();

    requestAnimationFrame(() => this.render());
  }

  private addText(str:string):void
  {
    const div:HTMLDivElement = document.createElement('div');
    div.innerText = str;
    document.body.appendChild(div);
  }
}

window.addEventListener(EventName.DOM_CONTENT_LOADED, () => new Main());
