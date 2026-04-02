

  // links scroll to form
  $("a:not(.js-noscroll)").click(function (e) {
    var top = $("#form").offset().top;
    e.preventDefault();
    $('body,html').animate({
      scrollTop: top
    }, 800);
  });

 